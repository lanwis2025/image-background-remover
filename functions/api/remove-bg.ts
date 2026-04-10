/**
 * POST /api/remove-bg
 *
 * 权限策略：
 *   - 未登录：直接拒绝（0次）
 *   - 免费注册用户：credits > 0 才能用，每次 -1
 *   - Pro 订阅用户：credits > 0 才能用（每月充值 200 credits）
 *
 * 水印策略：
 *   - free 用户（credits 包）：加水印 + 低分辨率
 *   - pro 订阅用户：无水印 + 全分辨率
 */

interface Env {
  REMOVE_BG_API_KEY: string;
  DB: D1Database;
}

interface UserRow {
  id: number;
  plan: string;
  credits: number;
}

async function getSessionUser(
  request: Request,
  db: D1Database
): Promise<UserRow | null> {
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
      `SELECT u.id, u.plan, u.credits
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token = ?1 AND s.expires_at > ?2`
    )
    .bind(sessionToken, now)
    .first<UserRow>();

  return row ?? null;
}

/**
 * 在图片 ArrayBuffer 上叠加水印（纯文字，右下角）
 * Cloudflare Workers 支持 Canvas API（通过 @cloudflare/workers-types）
 * 如果环境不支持 Canvas，退回为返回低分辨率缩略图策略
 */
async function addWatermark(imageBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  // Workers 环境没有原生 Canvas，用降分辨率作为水印替代策略
  // 实际水印可以在前端叠加（前端 Canvas），后端返回低分辨率版本
  // 这里返回原图，前端负责叠加水印展示（不允许下载原图）
  return imageBuffer;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // 1. 登录检查
  const user = await getSessionUser(context.request, context.env.DB);
  if (!user) {
    return Response.json(
      {
        error: "Please sign in to use this feature.",
        code: "UNAUTHENTICATED",
      },
      { status: 401 }
    );
  }

  // 2. 额度检查
  if (user.credits <= 0) {
    return Response.json(
      {
        error: "You have used all your credits. Please purchase more to continue.",
        code: "NO_CREDITS",
      },
      { status: 402 }
    );
  }

  // 3. 图片校验
  let imageFile: File | null = null;
  try {
    const formData = await context.request.formData();
    imageFile = formData.get("image") as File | null;
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  if (!imageFile) {
    return Response.json({ error: "Please upload an image file." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(imageFile.type)) {
    return Response.json(
      { error: "Please upload a JPG, PNG, or WebP image." },
      { status: 400 }
    );
  }

  if (imageFile.size > 10 * 1024 * 1024) {
    return Response.json(
      { error: "Image size must be under 10MB." },
      { status: 400 }
    );
  }

  const apiKey = context.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Service configuration error. Please contact support." },
      { status: 500 }
    );
  }

  // 4. 调用 remove.bg
  // Pro 用户全分辨率，free 用户低分辨率
  const isPro = user.plan === "pro";
  const rb = new FormData();
  rb.append("image_file", imageFile);
  rb.append("size", isPro ? "auto" : "preview"); // preview = 低分辨率（0.25MP）

  let response: Response;
  try {
    response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: rb,
    });
  } catch (err) {
    console.error("remove.bg network error:", err);
    return Response.json(
      { error: "Network error. Please try again." },
      { status: 500 }
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("remove.bg error:", errText);
    return Response.json(
      { error: "Background removal failed. Please try again." },
      { status: 500 }
    );
  }

  const resultBuffer = await response.arrayBuffer();

  // 5. 扣除 credits + 更新 total_used（处理成功后再扣）
  await context.env.DB.prepare(
    `UPDATE users
     SET credits = credits - 1,
         total_used = total_used + 1
     WHERE id = ?1 AND credits > 0`
  )
    .bind(user.id)
    .run();

  // 6. 返回结果
  // free 用户：后端返回低分辨率图，前端叠加水印展示
  // pro 用户：全分辨率，直接下载
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "X-User-Plan": user.plan,
    "X-Credits-Remaining": String(user.credits - 1),
  };

  if (isPro) {
    headers["Content-Disposition"] = 'attachment; filename="removed-bg.png"';
  }
  // free 用户不设 Content-Disposition，由前端控制下载行为（叠水印后才允许下载）

  return new Response(resultBuffer, { status: 200, headers });
};
