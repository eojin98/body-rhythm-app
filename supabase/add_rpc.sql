-- ============================================================
-- 기존 테이블(point_transactions, user_point_balances)이 이미 있는 경우
-- 이 파일만 Supabase SQL Editor에서 실행하세요.
-- CREATE OR REPLACE 이므로 기존 테이블/데이터에 영향 없음.
-- ============================================================

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
