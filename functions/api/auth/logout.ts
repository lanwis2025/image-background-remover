/**
 * POST /api/auth/logout
 * Deletes the current session from D1 and clears the cookie.
 */

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const cookieHeader = context.request.headers.get("Cookie") ?? "";
  const sessionToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

  if (sessionToken) {
    await context.env.DB.prepare(
      "DELETE FROM sessions WHERE session_token = ?1"
    ).bind(sessionToken).run();
  }

  const clearCookie = "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie,
    },
  });
};
