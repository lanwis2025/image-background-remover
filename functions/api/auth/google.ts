/**
 * POST /api/auth/google
 * Body: { id_token: string }
 *
 * Verifies the Google ID token, upserts the user in D1,
 * creates a session, and sets an HttpOnly session cookie.
 *
 * 新用户注册时自动赠送 3 credits（终身）。
 */

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
}

const SESSION_DURATION_DAYS = 30;
const COOKIE_NAME = "session";
const NEW_USER_CREDITS = 3;

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
    // 新用户：写入 credits = NEW_USER_CREDITS
    // 老用户：只更新 email/name/picture/last_login_at，不动 credits
    await context.env.DB.prepare(`
      INSERT INTO users (google_id, email, name, picture, credits, created_at, last_login_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
      ON CONFLICT(google_id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        picture = excluded.picture,
        last_login_at = excluded.last_login_at
    `)
      .bind(info.sub, info.email, info.name, info.picture, NEW_USER_CREDITS, now)
      .run();

    // Get user
    const user = await context.env.DB.prepare(
      "SELECT id, plan, credits, total_used FROM users WHERE google_id = ?1"
    )
      .bind(info.sub)
      .first<{ id: number; plan: string; credits: number; total_used: number }>();

    if (!user) throw new Error("User not found after upsert");

    // Create session
    const sessionToken = generateToken();
    await context.env.DB.prepare(`
      INSERT INTO sessions (session_token, user_id, created_at, expires_at)
      VALUES (?1, ?2, ?3, ?4)
    `)
      .bind(sessionToken, user.id, now, expiresAt)
      .run();

    // Keep only last 5 sessions
    await context.env.DB.prepare(`
      DELETE FROM sessions
      WHERE user_id = ?1
        AND id NOT IN (
          SELECT id FROM sessions WHERE user_id = ?1
          ORDER BY created_at DESC LIMIT 5
        )
    `)
      .bind(user.id)
      .run();

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
          plan: user.plan,
          credits: user.credits,
          total_used: user.total_used,
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
