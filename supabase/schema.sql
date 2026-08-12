-- ============================================================
-- Body Rhythm — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- ============================================================

-- ── 1. 포인트 트랜잭션 테이블 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS point_transactions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  local_id      text        NOT NULL,          -- 로컬 원장 entry.id (기기 생성 식별자)
  occurrence_id text,                          -- 강화알람 회차 ID (일반 알람은 NULL)
  alarm_id      text        NOT NULL,          -- periodId ('morning', 'test_09' 등)
  alarm_label   text,
  date          date        NOT NULL,          -- 알람 발화 날짜 'yyyy-MM-dd'
  action        text        NOT NULL,          -- POINT_ACTIONS 값
  points        integer     NOT NULL CHECK (points > 0),
  timer_seconds integer,                       -- boost_timer_complete 시 타이머(초)
  occurred_at   timestamptz NOT NULL,          -- 로컬 timestamp → ISO 변환값
  synced_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, local_id)                  -- 멱등성: 같은 기기 항목 중복 방지
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own" ON point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_select_own" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ── 2. 사용자 포인트 잔액 테이블 ───────────────────────────────
CREATE TABLE IF NOT EXISTS user_point_balances (
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_points integer     DEFAULT 0 NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_point_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_balance" ON user_point_balances
  FOR ALL USING (auth.uid() = user_id);

-- ── 3. 잔액 갱신 RPC (서버 SUM → upsert, 동시성 안전) ──────────
CREATE OR REPLACE FUNCTION refresh_user_balance(uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO user_point_balances (user_id, total_points, updated_at)
  SELECT uid, COALESCE(SUM(points), 0), now()
  FROM point_transactions
  WHERE user_id = uid
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = EXCLUDED.total_points,
        updated_at   = EXCLUDED.updated_at;
$$;
