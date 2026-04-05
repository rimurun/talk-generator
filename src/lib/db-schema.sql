-- Talk Generator Database Schema
-- Supabase (PostgreSQL) with Row Level Security

-- ==============================================
-- 1. users テーブル
-- ==============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL DEFAULT '',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  ng_words TEXT[] NOT NULL DEFAULT '{}',
  daily_limit INTEGER NOT NULL DEFAULT 30,
  preferred_tone TEXT NOT NULL DEFAULT 'フレンドリー',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: 2ユーザーアクセス制御
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ==============================================
-- 2. generated_cache テーブル
-- ==============================================
CREATE TABLE IF NOT EXISTS generated_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_type TEXT NOT NULL CHECK (cache_type IN ('topic', 'script', 'batch')),
  cache_key TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,

  UNIQUE (cache_type, cache_key)
);

-- 期限切れキャッシュの自動削除用インデックス
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON generated_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_type_key ON generated_cache (cache_type, cache_key);

-- RLS: キャッシュは全認証ユーザーがアクセス可能（共有キャッシュ）
ALTER TABLE generated_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cache_select_authenticated" ON generated_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cache_insert_authenticated" ON generated_cache
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cache_update_authenticated" ON generated_cache
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "cache_delete_authenticated" ON generated_cache
  FOR DELETE TO authenticated USING (true);

-- anon ロールからもアクセス可能（認証なしフォールバック用）
CREATE POLICY "cache_select_anon" ON generated_cache
  FOR SELECT TO anon USING (true);

CREATE POLICY "cache_insert_anon" ON generated_cache
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "cache_update_anon" ON generated_cache
  FOR UPDATE TO anon USING (true);

CREATE POLICY "cache_delete_anon" ON generated_cache
  FOR DELETE TO anon USING (true);

-- ==============================================
-- 3. favorites テーブル
-- ==============================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topic', 'script')),
  topic_id TEXT NOT NULL,
  script_id TEXT,
  title TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_topic_id ON favorites (user_id, topic_id);

-- RLS: 自分のお気に入りのみアクセス
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "favorites_update_own" ON favorites
  FOR UPDATE USING (auth.uid() = user_id);

-- ==============================================
-- 4. generation_history テーブル
-- ==============================================
CREATE TABLE IF NOT EXISTS generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topic', 'script')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  filters JSONB,
  topic_id TEXT,
  script_settings JSONB,
  cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_history_user_id ON generation_history (user_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON generation_history (user_id, timestamp DESC);

-- RLS: 自分の履歴のみアクセス
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_select_own" ON generation_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "history_insert_own" ON generation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "history_delete_own" ON generation_history
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- 5. script_ratings テーブル
-- ==============================================
CREATE TABLE IF NOT EXISTS script_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  rated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, script_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON script_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_script_id ON script_ratings (user_id, script_id);

-- RLS: 自分の評価のみアクセス
ALTER TABLE script_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select_own" ON script_ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ratings_insert_own" ON script_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ratings_update_own" ON script_ratings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ratings_delete_own" ON script_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- 期限切れキャッシュの自動削除（pg_cron使用）
-- Supabaseダッシュボードの SQL Editor で下記を有効化する
-- ==============================================
-- SELECT cron.schedule(
--   'cleanup-expired-cache',
--   '*/15 * * * *',  -- 15分おき
--   $$DELETE FROM generated_cache WHERE expires_at < now()$$
-- );

-- ==============================================
-- 6. rate_limits テーブル（サーバーサイドレート制限）
-- ==============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  path TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (identifier, path)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits (identifier, path, window_start);

-- RLS: サーバーサイドのみアクセス
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_all_anon" ON rate_limits
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "rate_limits_all_authenticated" ON rate_limits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================
-- 7. guest_usage テーブル（ゲスト使用回数追跡）
-- ==============================================
CREATE TABLE IF NOT EXISTS guest_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (ip_hash, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_guest_usage_lookup
  ON guest_usage (ip_hash, usage_date);

ALTER TABLE guest_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_usage_all_anon" ON guest_usage
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "guest_usage_all_authenticated" ON guest_usage
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================
-- 8. cost_tracking テーブル（API コスト追跡）
-- ==============================================
CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (period_key, period_type)
);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_lookup
  ON cost_tracking (period_key, period_type);

ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_tracking_all_anon" ON cost_tracking
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "cost_tracking_all_authenticated" ON cost_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================
-- レート制限アトミックチェック RPC
-- ==============================================
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_identifier TEXT,
  p_path TEXT,
  p_window_ms INTEGER,
  p_max_requests INTEGER
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ;
  v_row rate_limits%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  v_window_start := v_now - make_interval(secs := p_window_ms / 1000.0);

  -- 期限切れエントリを削除
  DELETE FROM rate_limits
  WHERE identifier = p_identifier AND path = p_path AND window_start <= v_window_start;

  -- 既存ウィンドウを取得して更新
  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE identifier = p_identifier AND path = p_path AND window_start > v_window_start
  RETURNING * INTO v_row;

  IF v_row IS NOT NULL THEN
    IF v_row.request_count > p_max_requests THEN
      -- 超過: カウントを戻す
      UPDATE rate_limits SET request_count = request_count - 1 WHERE id = v_row.id;
      RETURN json_build_object(
        'allowed', false,
        'remaining', 0,
        'resetAt', extract(epoch from v_row.window_start + make_interval(secs := p_window_ms / 1000.0)) * 1000
      );
    ELSE
      v_remaining := p_max_requests - v_row.request_count;
      RETURN json_build_object(
        'allowed', true,
        'remaining', v_remaining,
        'resetAt', extract(epoch from v_row.window_start + make_interval(secs := p_window_ms / 1000.0)) * 1000
      );
    END IF;
  ELSE
    -- 新規ウィンドウ作成
    INSERT INTO rate_limits (identifier, path, request_count, window_start)
    VALUES (p_identifier, p_path, 1, v_now)
    ON CONFLICT (identifier, path)
    DO UPDATE SET request_count = 1, window_start = v_now;

    RETURN json_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'resetAt', extract(epoch from v_now + make_interval(secs := p_window_ms / 1000.0)) * 1000
    );
  END IF;
END;
$$;

-- 古い rate_limits の定期クリーンアップ
-- SELECT cron.schedule(
--   'cleanup-expired-rate-limits',
--   '*/5 * * * *',
--   $$DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '10 minutes'$$
-- );

-- 古い guest_usage の定期クリーンアップ
-- SELECT cron.schedule(
--   'cleanup-old-guest-usage',
--   '0 0 * * *',
--   $$DELETE FROM guest_usage WHERE usage_date < CURRENT_DATE - INTERVAL '7 days'$$
-- );
