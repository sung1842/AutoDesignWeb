-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(0001_init). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 0001_init: 확장·공통 함수 =====
create extension if not exists pgcrypto;
-- pgvector는 MVP에서 쓰지 않는다(S-22). Phase 2 임베딩은 additive 마이그레이션으로 확장·컬럼을 추가한다(05장 D-055)

create or replace function is_l1(v jsonb, lo numeric default 0, hi numeric default 1)
returns boolean language sql immutable as $$
  select jsonb_typeof(v) = 'object'
     and (select array_agg(k order by k) from jsonb_object_keys(v) k)
         = array['density','depth','expression','shape','temperature']      -- R-01
     and not exists (select 1 from jsonb_each(v) e
                     where jsonb_typeof(e.value) <> 'number'
                        or (e.value)::numeric < lo or (e.value)::numeric > hi)
$$;
create or replace function kst_day(ts timestamptz) returns date
  language sql immutable as $$ select (ts at time zone 'Asia/Seoul')::date $$;
create or replace function kst_month(ts timestamptz) returns date
  language sql immutable as $$ select date_trunc('month', ts at time zone 'Asia/Seoul')::date $$;
create or replace function touch_updated_at() returns trigger language plpgsql as $$
  begin new.updated_at := now(); return new; end $$;

-- ===== 사용자·동의 =====
create table users (                                  -- 00장 IF-07, 08장의 profiles
  id              uuid primary key references auth.users(id) on delete cascade,
  role            text not null default 'user' check (role in ('user','admin')),
  is_internal     boolean not null default false,     -- 운영자·지인 테스트 계정(KPI 제외)
  display_name    text null check (char_length(display_name) <= 40),  -- 자동 채움 금지(08장 8.7.1)
  status          text not null default 'active' check (status in ('active','gen_suspended','suspended','deleting')),  -- deleting = account-delete 진행 중(S-21)
  suspend_source  text null check (suspend_source in ('hold','sanction','admin')),  -- U-06: 정지 사유 원천. active면 null
  quota_day_override   smallint null check (quota_day_override between 0 and 50),   -- ADM-06
  quota_month_override smallint null check (quota_month_override between 0 and 500),
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz not null default now()
);
-- users 행 생성·관리자 판정·제재 승계는 auth.users 트리거가 하지 않는다(T-12). 로그인 콜백마다 web이
-- withService로 provision_user()(아래 '사용자 프로비저닝')를 호출한다. 옛 auth.users INSERT 트리거 규칙 → T-12로 대체.

-- OAuth 메타데이터 최소화(S-25, 08장 8.7.1): 공급자가 보낸 이름·사진 등을 저장하지 않는다.
create or replace function minimize_auth_metadata() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare keep text[] := array['email','email_verified','provider_id','sub','iss'];
begin
  if tg_table_name = 'users' then
    new.raw_user_meta_data := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                               from jsonb_each(coalesce(new.raw_user_meta_data, '{}'::jsonb)) as e(k, v) where k = any(keep));
  else
    new.identity_data := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                          from jsonb_each(coalesce(new.identity_data, '{}'::jsonb)) as e(k, v) where k = any(keep));
  end if;
  return new;
end $$;
create trigger auth_users_minimize before insert or update on auth.users
  for each row execute function minimize_auth_metadata();
create trigger auth_identities_minimize before insert or update on auth.identities
  for each row execute function minimize_auth_metadata();
-- native 프로파일은 shim의 auth.users·auth.identities에 공급자 형태 행을 직접 넣어 시험한다.
-- 실제 Google 흐름의 키 덤프는 needs_ci(gotrue-google-metadata), 결과는 docs/compliance/auth-metadata.md.

create table identity_links (                         -- 00장 8.4
  anon_id    text not null,                           -- events.anon_id와 같은 text 표기(uuid 문자열)
  user_id    uuid not null references users(id) on delete cascade,
  linked_at  timestamptz not null default now(),
  primary key (anon_id, user_id)
);

create table consents (                               -- 08장 8.7.4 C
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid null references users(id) on delete cascade,
  anon_id      uuid null,
  doc_type     text not null check (doc_type in ('terms','privacy_notice','age_14','privacy_consent','brand_attestation','showcase_optin')),
  doc_version  text not null check (doc_version ~ '^\d{4}-\d{2}-\d{2}$'),
  agreed       boolean not null,
  shown_at     timestamptz not null,
  agreed_at    timestamptz null,
  subject_ref  text null,                             -- brand_attestation 대상(정규화 브랜드명 SHA-256)
  ip_hmac      text null,
  check (user_id is not null or anon_id is not null)
);
create index on consents (user_id, doc_type, doc_version);

create table consents_archive (                       -- 탈퇴 후 동의 증빙 1년(S-21, 08장 8.7.7)
  id           uuid primary key default gen_random_uuid(),
  user_hash    text not null,                         -- HMAC-SHA256(user_id, CONSENT_HASH_KEY). 키는 교체하지 않는다
  doc_type     text not null,
  doc_version  text not null,
  agreed       boolean not null,
  agreed_at    timestamptz null,
  archived_at  timestamptz not null default now()
);
create index on consents_archive (archived_at);

create table sanctions (                              -- 정지 이력 재가입 방지(S-21, 08장 8.9.5). 보관 근거는 사람 확인(08 8.14 Q6)
  email_hash   text primary key,                      -- HMAC-SHA256(lower(trim(email)), CONSENT_HASH_KEY)
  level        text not null check (level in ('gen_suspended','suspended')),
  until        timestamptz not null check (until <= created_at + interval '1 year'),
  reason_code  text not null,
  created_at   timestamptz not null default now()
);

create table abuse_holds (                            -- 탈퇴 보류(T-15, LG3-04): 처리 중 사칭·피싱 신고가 있는 계정의 재가입 승계용
  email_hash   text primary key,                      -- sanctions와 같은 HMAC
  report_ids   uuid[] not null check (cardinality(report_ids) >= 1),
  until        timestamptz not null,                  -- 마지막 신고 검토 종료 + 90일(abuse_evidence_90d와 같은 기준, 08 8.14 Q6). 미처리 중에는 retention이 now()+90d로 연장(U-06)
  created_at   timestamptz not null default now()
);
-- consents_archive·sanctions·abuse_holds는 RLS 켜고 정책 0개(service_role 전용).

-- 사용자 프로비저닝(T-12, 6.5.4). HMAC은 web이 계산해 넘긴다. 키는 DB에 두지 않는다(AC-06-60 ①).
create or replace function provision_user(p_user_id uuid, p_is_admin boolean, p_email_hash text)
returns users language plpgsql security definer set search_path = public as $$
declare r users; s record; h record;
begin
  insert into users (id) values (p_user_id) on conflict (id) do update set last_login_at = now();
  update users set role = case when p_is_admin then 'admin' else 'user' end
   where id = p_user_id and role is distinct from (case when p_is_admin then 'admin' else 'user' end);
  select level, until into s from sanctions where email_hash = p_email_hash and until > now();
  select until into h from abuse_holds where email_hash = p_email_hash and until > now();
  if s.level is not null then
    update users set status = s.level, suspend_source = 'sanction' where id = p_user_id and status = 'active';
  elsif h.until is not null then
    update users set status = 'gen_suspended', suspend_source = 'hold' where id = p_user_id and status = 'active';  -- 신고 검토 종료 전 재가입: 생성만 보류
  else
    update users set status = 'active', suspend_source = null
     where id = p_user_id and status = 'gen_suspended' and suspend_source = 'hold';  -- U-06: 보류 해제 후 복구
  end if;
  select * into r from users where id = p_user_id;
  return r;
end $$;

create table invites (                                -- 00장 7.2, BETA_INVITE_ONLY
  code        text primary key check (code ~ '^[A-Z0-9]{8,16}$'),
  max_uses    int not null check (max_uses between 1 and 1000),
  used_count  int not null default 0 check (used_count <= max_uses),
  expires_at  timestamptz not null,
  created_by  uuid null references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table invite_redemptions (
  code     text not null references invites(code) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
