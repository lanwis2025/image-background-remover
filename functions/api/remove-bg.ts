interface Env {
  REMOVE_BG_API_KEY: string;
  DB: D1Database;
}

async function getSessionUser(
  request: Request,
  db: D1Database
): Promise<{ id: number } | null> {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const sessionToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

  if (!sessionToken) return null;

  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `SELECT u.id FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token = ?1 AND s.expires_at > ?2`
    )
    .bind(sessionToken, now)
    .first<{ id: number }>();

  return row ?? null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // Auth check
  const user = await getSessionUser(context.request, context.env.DB);
  if (!user) {
    return Response.json(
      { error: "请先登录后再使用去背景功能" },
      { status: 401 }
    );
  }

  try {
    const formData = await context.request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return Response.json({ error: "请上传图片文件" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return Response.json(
        { error: "请上传 JPG/PNG/WebP 格式图片" },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "图片大小不能超过 10MB" },
        { status: 400 }
      );
    }

    const apiKey = context.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "服务配置错误，请联系管理员" },
        { status: 500 }
      );
    }

    const rb = new FormData();
    rb.append("image_file", imageFile);
    rb.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: rb,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("remove.bg error:", errText);
      return Response.json({ error: "处理失败，请稍后重试" }, { status: 500 });
    }

    const resultBuffer = await response.arrayBuffer();

    return new Response(resultBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="removed-bg.png"',
      },
    });
  } catch (err) {
    console.error("API error:", err);
    return Response.json({ error: "请求超时，请检查网络后重试" }, { status: 500 });
  }
};
