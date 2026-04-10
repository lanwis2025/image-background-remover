/**
 * GET /api/auth/me
 * Returns current user info + plan + credits based on session cookie.
 * Returns 401 if not authenticated.
 */

interface Env {
  DB: D1Database;
}

interface UserRow {
  name: string;
  email: string;
  picture: string;
  plan: string;
  credits: number;
  total_used: number;
  created_at: number;
  last_login_at: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cookieHeader = context.request.headers.get("Cookie") ?? "";
  const sessionToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

  if (!sessionToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);

  const row = await context.env.DB.prepare(`
    SELECT u.name, u.email, u.picture,
           u.plan, u.credits, u.total_used,
           u.created_at, u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.session_token = ?1 AND s.expires_at > ?2
  `)
    .bind(sessionToken, now)
    .first<UserRow>();

  if (!row) {
    return Response.json({ error: "Session expired or invalid" }, { status: 401 });
  }

  return Response.json({
    ok: true,
    user: {
      name: row.name,
      email: row.email,
      picture: row.picture,
      plan: row.plan,
      credits: row.credits,
      total_used: row.total_used,
      created_at: row.created_at,
      last_login_at: row.last_login_at,
    },
  });
};
