-- D1 database schema for imagebackgroundremover.solutions

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id   TEXT    NOT NULL UNIQUE,
  email       TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  picture     TEXT    NOT NULL,
  -- plan: free | pro
  plan        TEXT    NOT NULL DEFAULT 'free',
  -- 终身赠送额度（注册时写入3，用完为0）
  credits     INTEGER NOT NULL DEFAULT 3,
  -- 历史总使用次数
  total_used  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT  NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL  -- unix timestamp
);

-- 订单记录（LemonSqueezy）
CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ls_order_id       TEXT    NOT NULL UNIQUE,  -- LemonSqueezy order id
  ls_variant_id     TEXT    NOT NULL,          -- 对应哪个产品档位
  order_type        TEXT    NOT NULL,          -- 'credits' | 'subscription'
  credits_added     INTEGER NOT NULL DEFAULT 0,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT    NOT NULL DEFAULT 'USD',
  status            TEXT    NOT NULL DEFAULT 'paid',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 订阅记录（月付/年付）
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ls_subscription_id  TEXT    NOT NULL UNIQUE,
  ls_variant_id       TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'active',  -- active | cancelled | expired
  credits_per_cycle   INTEGER NOT NULL DEFAULT 200,
  current_period_end  INTEGER,  -- unix timestamp
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
