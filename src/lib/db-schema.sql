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
