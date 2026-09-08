-- ============================================================
-- Body Rhythm — 닉네임 기능 추가
-- Supabase 대시보드 > SQL Editor 에서 순서대로 실행하세요.
-- ============================================================

-- ── 1. profiles 테이블 ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
);

-- nickname 컬럼 추가 (기존 행은 NULL 허용 — 기존 테스터 대응)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname text;

-- lower() 기준 유니크 인덱스 (NULL 행은 제외 — 기존 NULL 계정과 충돌 없음)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_lower_uniq
  ON profiles (lower(nickname))
  WHERE nickname IS NOT NULL;

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 기존 policy 충돌 방지를 위해 DROP 후 재생성
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- INSERT는 set_nickname RPC(SECURITY DEFINER)를 통하지만,
-- 직접 INSERT 경로도 본인 행만 허용
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 본인 행만 UPDATE 가능
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- GRANT (과거 42501 "No permission" 오류 이력 대응 — 반드시 포함)
GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;


-- ── 2. check_nickname_available RPC ──────────────────────────────────────────
-- 닉네임 사용 가능 여부만 반환 (타인 행 노출 없음)
-- anon 포함: 회원가입 페이지는 비로그인 상태에서 호출

CREATE OR REPLACE FUNCTION check_nickname_available(p_nickname text)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(nickname) = lower(p_nickname)
      AND nickname IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION check_nickname_available(text) TO authenticated, anon;


-- ── 3. set_nickname RPC ───────────────────────────────────────────────────────
-- 형식 검증 + 유니크 위반 시 명확한 에러 코드 반환
-- SECURITY DEFINER: RLS 우회 후 본인 행에 upsert

CREATE OR REPLACE FUNCTION set_nickname(p_nickname text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- 형식 검증: 2~12자 (char_length는 바이트가 아닌 코드포인트 기준 — 한글 1자 = 1)
  IF p_nickname IS NULL
     OR char_length(p_nickname) < 2
     OR char_length(p_nickname) > 12 THEN
    RAISE EXCEPTION 'NICKNAME_LENGTH'
      USING ERRCODE = 'P0001';
  END IF;

  -- 한글/영문/숫자만 허용 (공백·특수문자 불가)
  IF p_nickname !~ '^[가-힣a-zA-Z0-9]+$' THEN
    RAISE EXCEPTION 'NICKNAME_FORMAT'
      USING ERRCODE = 'P0001';
  END IF;

  -- upsert: 중복 닉네임(lower 유니크 인덱스 위반) 시 23505로 캐치
  BEGIN
    INSERT INTO profiles (id, nickname)
      VALUES (auth.uid(), p_nickname)
    ON CONFLICT (id)
      DO UPDATE SET nickname = EXCLUDED.nickname;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'NICKNAME_TAKEN'
        USING ERRCODE = 'P0001';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION set_nickname(text) TO authenticated;
