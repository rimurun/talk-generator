-- ============================================
-- Talk Generator DB Migration v2
-- セキュリティ・堅牢性強化
-- Supabase SQL Editorで実行してください
-- ============================================

-- 1. レート制限テーブル
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
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "rate_limits_all_anon" ON rate_limits FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rate_limits_all_authenticated" ON rate_limits FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ゲスト使用回数テーブル
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
DO $$ BEGIN
  CREATE POLICY "guest_usage_all_anon" ON guest_usage FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "guest_usage_all_authenticated" ON guest_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. コスト追跡テーブル
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
DO $$ BEGIN
  CREATE POLICY "cost_tracking_all_anon" ON cost_tracking FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cost_tracking_all_authenticated" ON cost_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RPC: レート制限（SELECT FOR UPDATE でアトミック）
-- ============================================
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
  v_cutoff TIMESTAMPTZ := v_now - make_interval(secs := p_window_ms / 1000.0);
  v_row rate_limits%ROWTYPE;
BEGIN
  -- 行ロック取得
  SELECT * INTO v_row FROM rate_limits
  WHERE identifier = p_identifier AND path = p_path
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    IF v_row.window_start <= v_cutoff THEN
      -- ウィンドウ期限切れ → リセット
      UPDATE rate_limits SET request_count = 1, window_start = v_now WHERE id = v_row.id;
      RETURN json_build_object(
        'allowed', true, 'remaining', p_max_requests - 1,
        'resetAt', extract(epoch from v_now + make_interval(secs := p_window_ms / 1000.0)) * 1000
      );
    ELSIF v_row.request_count >= p_max_requests THEN
      -- 上限到達
      RETURN json_build_object(
        'allowed', false, 'remaining', 0,
        'resetAt', extract(epoch from v_row.window_start + make_interval(secs := p_window_ms / 1000.0)) * 1000
      );
    ELSE
      -- インクリメント
      UPDATE rate_limits SET request_count = request_count + 1 WHERE id = v_row.id;
      RETURN json_build_object(
        'allowed', true, 'remaining', p_max_requests - v_row.request_count - 1,
        'resetAt', extract(epoch from v_row.window_start + make_interval(secs := p_window_ms / 1000.0)) * 1000
      );
    END IF;
  ELSE
    -- 新規作成
    BEGIN
      INSERT INTO rate_limits (identifier, path, request_count, window_start)
      VALUES (p_identifier, p_path, 1, v_now);
    EXCEPTION WHEN unique_violation THEN
      -- 同時挿入の競合 → リトライ
      RETURN check_and_increment_rate_limit(p_identifier, p_path, p_window_ms, p_max_requests);
    END;
    RETURN json_build_object(
      'allowed', true, 'remaining', p_max_requests - 1,
      'resetAt', extract(epoch from v_now + make_interval(secs := p_window_ms / 1000.0)) * 1000
    );
  END IF;
END;
$$;

-- ============================================
-- RPC: ゲスト使用回数チェック+消費（アトミック）
-- ============================================
CREATE OR REPLACE FUNCTION check_and_increment_guest_usage(
  p_ip_hash TEXT,
  p_max_usage INTEGER
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Tokyo')::DATE;
  v_row guest_usage%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM guest_usage
  WHERE ip_hash = p_ip_hash AND usage_date = v_today
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    IF v_row.usage_count >= p_max_usage THEN
      RETURN json_build_object('allowed', false, 'remaining', 0, 'used', v_row.usage_count);
    ELSE
      UPDATE guest_usage SET usage_count = usage_count + 1, last_used_at = now() WHERE id = v_row.id;
      RETURN json_build_object('allowed', true, 'remaining', p_max_usage - v_row.usage_count - 1, 'used', v_row.usage_count + 1);
    END IF;
  ELSE
    BEGIN
      INSERT INTO guest_usage (ip_hash, usage_count, usage_date, last_used_at)
      VALUES (p_ip_hash, 1, v_today, now());
    EXCEPTION WHEN unique_violation THEN
      RETURN check_and_increment_guest_usage(p_ip_hash, p_max_usage);
    END;
    RETURN json_build_object('allowed', true, 'remaining', p_max_usage - 1, 'used', 1);
  END IF;
END;
$$;

-- ============================================
-- RPC: コスト記録（アトミック upsert）
-- ============================================
CREATE OR REPLACE FUNCTION record_api_cost(
  p_cost DOUBLE PRECISION
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today TEXT := to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD');
  v_month TEXT := to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM');
  v_daily DOUBLE PRECISION;
  v_monthly DOUBLE PRECISION;
BEGIN
  INSERT INTO cost_tracking (period_key, period_type, total_cost, updated_at)
  VALUES (v_today, 'daily', p_cost, now())
  ON CONFLICT (period_key, period_type)
  DO UPDATE SET total_cost = cost_tracking.total_cost + p_cost, updated_at = now()
  RETURNING total_cost INTO v_daily;

  INSERT INTO cost_tracking (period_key, period_type, total_cost, updated_at)
  VALUES (v_month, 'monthly', p_cost, now())
  ON CONFLICT (period_key, period_type)
  DO UPDATE SET total_cost = cost_tracking.total_cost + p_cost, updated_at = now()
  RETURNING total_cost INTO v_monthly;

  RETURN json_build_object('dailyTotal', v_daily, 'monthlyTotal', v_monthly);
END;
$$;
