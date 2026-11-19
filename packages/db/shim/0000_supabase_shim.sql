-- native 프로파일 전용 Supabase shim(06장 6.13.1 스택 프로파일 표, T-11·T-13).
-- 상단 가드: auth 스키마가 이미 있으면(supabase 프로파일) 아무것도 하지 않는다.
DO $shim$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RAISE NOTICE 'supabase shim: auth 스키마가 있어 건너뜀';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tastefit_app') THEN
    CREATE ROLE tastefit_app LOGIN NOBYPASSRLS PASSWORD 'tastefit_app';
  END IF;
  GRANT anon, authenticated, service_role TO tastefit_app;

  CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE auth.identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    provider text NOT NULL,
    identity_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE auth.audit_log_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payload jsonb,
    ip_address varchar(64),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE auth.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    user_agent text,
    ip inet,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    not_after timestamptz
  );

  -- auth.uid()·auth.role()·auth.jwt() = request.jwt.claims(SET LOCAL, DbPort.withUser·withAnon)
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
    $f$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $f$ SELECT nullif(auth.jwt() ->> 'sub', '')::uuid $f$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
    $f$ SELECT auth.jwt() ->> 'role' $f$;
  GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role() TO anon, authenticated, service_role;

  -- service_role은 auth 사용자 관리 가능(GoTrue admin API 대응, local AuthPort·테스트 픽스처)
  GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;

  -- Supabase 기본 권한 재현: public 객체는 세 역할에 기본 GRANT(행 접근은 RLS·마이그레이션 revoke가 좁힌다)
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
END
$shim$;
