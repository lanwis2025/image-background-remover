/**
 * POST /api/auth/google
 * Body: { id_token: string }
 *
 * Verifies the Google ID token, upserts the user in D1,
 * creates a session, and sets an HttpOnly session cookie.
 */

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
}

const SESSION_DURATION_DAYS = 30;
const COOKIE_NAME = "session";

function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface GoogleTokenInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  aud: string;
  exp: string;
}

async function verifyGoogleToken(
  idToken: string,
  clientId: string
): Promise<GoogleTokenInfo> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to verify token");
  const info = (await res.json()) as GoogleTokenInfo;

  if (info.aud !== clientId) throw new Error("Token audience mismatch");
  if (Number(info.exp) < Date.now() / 1000) throw new Error("Token expired");
  if (!info.sub || !info.email) throw new Error("Missing required fields");

  return info;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json<{ id_token?: string }>();
    if (!body?.id_token) {
      return Response.json({ error: "Missing id_token" }, { status: 400 });
    }

    // Verify with Google
    const info = await verifyGoogleToken(body.id_token, context.env.GOOGLE_CLIENT_ID);

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + SESSION_DURATION_DAYS * 86400;

    // Upsert user
    await context.env.DB.prepare(`
      INSERT INTO users (google_id, email, name, picture, created_at, last_login_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5)
      ON CONFLICT(google_id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        picture = excluded.picture,
        last_login_at = excluded.last_login_at
    `).bind(info.sub, info.email, info.name, info.picture, now).run();

    // Get user id
    const user = await context.env.DB.prepare(
      "SELECT id FROM users WHERE google_id = ?1"
    ).bind(info.sub).first<{ id: number }>();

    if (!user) throw new Error("User not found after upsert");

    // Create session
    const sessionToken = generateToken();
    await context.env.DB.prepare(`
      INSERT INTO sessions (session_token, user_id, created_at, expires_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(sessionToken, user.id, now, expiresAt).run();

    // Clean up old sessions for this user (keep last 5)
    await context.env.DB.prepare(`
      DELETE FROM sessions
      WHERE user_id = ?1
        AND id NOT IN (
          SELECT id FROM sessions WHERE user_id = ?1
          ORDER BY created_at DESC LIMIT 5
        )
    `).bind(user.id).run();

    const cookieValue = [
      `${COOKIE_NAME}=${sessionToken}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=${SESSION_DURATION_DAYS * 86400}`,
      `Secure`,
    ].join("; ");

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          name: info.name,
          email: info.email,
          picture: info.picture,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieValue,
        },
      }
    );
  } catch (err) {
    console.error("Auth error:", err);
    return Response.json({ error: "Authentication failed" }, { status: 401 });
  }
};
