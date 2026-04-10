/**
 * POST /api/payments/webhook
 *
 * LemonSqueezy Webhook 处理器
 * 事件：
 *   - order_created        → 一次性积分包，充值 credits
 *   - subscription_created → 订阅创建，升级 plan + 充值 credits
 *   - subscription_renewed → 订阅续费，充值 credits
 *   - subscription_cancelled → 订阅取消，更新状态（到期才降级）
 *   - subscription_expired → 订阅到期，降级为 free
 *
 * 环境变量：
 *   LS_WEBHOOK_SECRET  - LemonSqueezy Webhook 签名密钥
 *   DB                 - D1 database binding
 *
 * Credits 档位（需与 LemonSqueezy 后台 variant_id 对应）：
 *   在 wrangler.toml 或 env 中配置 LS_VARIANT_* 变量
 */

interface Env {
  DB: D1Database;
  LS_WEBHOOK_SECRET: string;
  // Credits 积分包 variant IDs（在 LemonSqueezy 后台创建产品后填入）
  LS_VARIANT_STARTER: string;    // $5.9  → 25 credits
  LS_VARIANT_BASIC: string;      // $14.9 → 75 credits
  LS_VARIANT_PRO_PACK: string;   // $29.9 → 200 credits
  // 订阅 variant IDs
  LS_VARIANT_PRO_MONTHLY: string; // $9.9/月 → 200 credits/月
  LS_VARIANT_PRO_YEARLY: string;  // $79/年  → 200 credits/月
}

const CREDITS_MAP: Record<string, number> = {
  STARTER: 25,
  BASIC: 75,
  PRO_PACK: 200,
  PRO_MONTHLY: 200,
  PRO_YEARLY: 200,
};

async function verifySignature(
  request: Request,
  secret: string
): Promise<{ valid: boolean; body: string }> {
  const signature = request.headers.get("X-Signature");
  if (!signature) return { valid: false, body: "" };

  const body = await request.text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { valid: expected === signature, body };
}

function getCreditsForVariant(variantId: string, env: Env): number {
  if (variantId === env.LS_VARIANT_STARTER) return CREDITS_MAP.STARTER;
  if (variantId === env.LS_VARIANT_BASIC) return CREDITS_MAP.BASIC;
  if (variantId === env.LS_VARIANT_PRO_PACK) return CREDITS_MAP.PRO_PACK;
  if (variantId === env.LS_VARIANT_PRO_MONTHLY) return CREDITS_MAP.PRO_MONTHLY;
  if (variantId === env.LS_VARIANT_PRO_YEARLY) return CREDITS_MAP.PRO_YEARLY;
  return 0;
}

function isSubscriptionVariant(variantId: string, env: Env): boolean {
  return (
    variantId === env.LS_VARIANT_PRO_MONTHLY ||
    variantId === env.LS_VARIANT_PRO_YEARLY
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { valid, body } = await verifySignature(
    context.request,
    context.env.LS_WEBHOOK_SECRET
  );

  if (!valid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.meta as { event_name: string };
  const data = payload.data as {
    id: string;
    attributes: Record<string, unknown>;
  };

  const attrs = data?.attributes ?? {};
  const userEmail = attrs.user_email as string;
  const variantId = String(attrs.variant_id ?? "");
  const lsOrderId = data?.id;

  if (!userEmail) {
    return Response.json({ error: "Missing user_email" }, { status: 400 });
  }

  // 查找用户
  const user = await context.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1"
  )
    .bind(userEmail)
    .first<{ id: number }>();

  if (!user) {
    // 用户可能还未注册，记录日志，不报错（LS 会重试）
    console.warn("Webhook: user not found for email:", userEmail);
    return Response.json({ ok: true, note: "user_not_found" });
  }

  const now = Math.floor(Date.now() / 1000);
  const event = (eventName as unknown as { event_name: string }).event_name ?? eventName;

  switch (event) {
    case "order_created": {
      // 一次性积分包
      const credits = getCreditsForVariant(variantId, context.env);
      if (credits === 0) break;

      await context.env.DB.prepare(
        `INSERT OR IGNORE INTO orders
           (user_id, ls_order_id, ls_variant_id, order_type, credits_added, status, created_at)
         VALUES (?1, ?2, ?3, 'credits', ?4, 'paid', ?5)`
      )
        .bind(user.id, lsOrderId, variantId, credits, now)
        .run();

      await context.env.DB.prepare(
        "UPDATE users SET credits = credits + ?1 WHERE id = ?2"
      )
        .bind(credits, user.id)
        .run();
      break;
    }

    case "subscription_created":
    case "subscription_renewed": {
      const credits = getCreditsForVariant(variantId, context.env);
      const lsSubId = String(attrs.subscription_id ?? data.id);
      const periodEnd = attrs.renews_at
        ? Math.floor(new Date(attrs.renews_at as string).getTime() / 1000)
        : null;

      // 升级 plan
      await context.env.DB.prepare(
        "UPDATE users SET plan = 'pro', credits = credits + ?1 WHERE id = ?2"
      )
        .bind(credits, user.id)
        .run();

      // 写入/更新订阅记录
      await context.env.DB.prepare(
        `INSERT INTO subscriptions
           (user_id, ls_subscription_id, ls_variant_id, status, credits_per_cycle, current_period_end, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'active', ?4, ?5, ?6, ?6)
         ON CONFLICT(ls_subscription_id) DO UPDATE SET
           status = 'active',
           current_period_end = excluded.current_period_end,
           updated_at = excluded.updated_at`
      )
        .bind(lsSubId, variantId, credits, periodEnd, now)
        .run();
      break;
    }

    case "subscription_cancelled": {
      const lsSubId = String(attrs.subscription_id ?? data.id);
      await context.env.DB.prepare(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = ?1
         WHERE ls_subscription_id = ?2`
      )
        .bind(now, lsSubId)
        .run();
      // 注意：plan 不立即降级，等 subscription_expired 事件
      break;
    }

    case "subscription_expired": {
      const lsSubId = String(attrs.subscription_id ?? data.id);
      await context.env.DB.prepare(
        `UPDATE subscriptions SET status = 'expired', updated_at = ?1
         WHERE ls_subscription_id = ?2`
      )
        .bind(now, lsSubId)
        .run();

      // 降级为 free
      await context.env.DB.prepare(
        "UPDATE users SET plan = 'free' WHERE id = ?1"
      )
        .bind(user.id)
        .run();
      break;
    }
  }

  return Response.json({ ok: true });
};
