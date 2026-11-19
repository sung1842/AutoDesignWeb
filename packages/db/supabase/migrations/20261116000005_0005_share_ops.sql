-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(0005_share_ops). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 0005_share_ops =====
create table share_links (
  id            text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),     -- share_id, 132비트
  target_type   text not null check (target_type in ('result','mockup')),
  result_id     uuid null references diagnosis_results(id) on delete cascade,
  mockup_id     uuid null references mockups(id) on delete cascade,
  version_id    uuid null references mockup_versions(id) on delete cascade,   -- 공유 시점 고정 버전
  owner_user_id uuid null references users(id) on delete cascade,
  owner_anon_id uuid null,
  is_public     boolean not null,                     -- result 기본 true, mockup 기본 false
  hidden_reason text null check (hidden_reason in ('report_auto','admin','rights')),
  hidden_at     timestamptz null,
  created_at    timestamptz not null default now(),
  check ((target_type = 'result' and result_id is not null and mockup_id is null)
      or (target_type = 'mockup' and mockup_id is not null and version_id is not null and result_id is null)),
  check (owner_user_id is not null or owner_anon_id is not null)
);
create unique index share_one_per_target on share_links (coalesce(result_id, mockup_id));

create table reports (                                -- 00장 10.3 + 08장 8.9.5 통합
  id               uuid primary key default gen_random_uuid(),
  share_id         text not null check (share_id ~ '^[A-Za-z0-9_-]{22}$'),  -- FK 없음(T-15): 공유 링크·계정이 삭제돼도 신고 행은 남는다
  evidence         jsonb null,                        -- 신고 시점 스냅샷 {targetType, versionId, ownerHash, objectPaths[]}. 객체는 abuse-evidence 버킷(T-15)
  reason           text not null check (reason in ('impersonation','phishing','copyright','trademark','inappropriate','other')),
  details          text null check (char_length(details) <= 1000),
  reporter_anon_id uuid not null,
  reporter_user_id uuid null references users(id) on delete set null,
  reporter_email   text null,
  ip_hmac          text not null,
  status           text not null default 'open' check (status in ('open','hidden','dismissed','actioned')),
  handled_by       uuid null references users(id) on delete set null,
  handled_at       timestamptz null,
  created_at       timestamptz not null default now()
);
create index on reports (share_id, created_at);

create table support_tickets (                        -- 00장 10.2
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid null references users(id) on delete set null,
  anon_id           uuid null,
  email             text not null check (char_length(email) <= 254),
  category          text not null check (category in ('account','generation','export','privacy','rights','bug','other')),
  body              text not null check (char_length(body) between 10 and 2000),
  status            text not null default 'open' check (status in ('open','answered','closed')),
  created_at        timestamptz not null default now(),
  first_response_at timestamptz null,
  closed_at         timestamptz null
);

create table blocked_brands (                         -- 00장 ADM-10 / 08장 8.9.2 HighRiskBrand
  id         text primary key,
  canonical  text not null,
  aliases    text[] not null default '{}',
  category   text not null check (category in ('bank','card','securities','insurance','payment','crypto','telecom','portal','commerce','delivery','logistics','government','public')),
  domains    text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 초기 데이터: config/high_risk_brands.json → db:seed. 이후 ADM-10에서 편집(감사 로그)

create table feature_flags (                          -- 00장 IF-09, 6.10.4 키 목록
  key        text primary key,
  value      jsonb not null,
  updated_by uuid null references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table rate_limits (                            -- 고정 윈도 카운터, 보관 48시간
  key          text not null,                         -- 예 'gen:min:u:<uuid>', 'survey:day:ip:<hmac>'
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);

create table idempotency_keys (
  owner_key     text not null,                        -- 'u:<uuid>' | 'a:<anon_id>'
  route         text not null,
  key           text not null check (key ~ '^[A-Za-z0-9_-]{16,64}$'),
  request_sha256 text not null,
  status_code   smallint null,                        -- null = 처리 중
  response_body jsonb null,
  created_at    timestamptz not null default now(),
  primary key (owner_key, route, key)
);

create table admin_audit_logs (                       -- 00장 10.1. UPDATE 금지, 1년 지난 행만 purge_audit_logs로 파기(T-14)
  id          uuid primary key default gen_random_uuid(),
  admin_hash  text null,                             -- HMAC-SHA256(관리자 user_id, CONSENT_HASH_KEY). FK 없음: append-only라 참조 동작 UPDATE 불가(S-21). null = 시스템 배치
  action      text not null,
  target_type text not null,
  target_id   text null,
  before      jsonb null,
  after       jsonb null,
  ip_hmac     text null,
  created_at  timestamptz not null default now()
);
create index on admin_audit_logs (created_at);
-- 보관 규칙 admin_audit_1y(T-14, 08 8.7.7). 근거(정의 변경): '1년 후 0건'(AC-08-33)과 'DELETE 전면 금지'는 동시에 성립하지 않는다.
create or replace function admin_audit_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception 'admin_audit_logs is append-only' using errcode = '42501'; end if;
  if current_setting('tastefit.audit_purge', true) is distinct from 'on'
     or old.created_at >= now() - interval '1 year' then
    raise exception 'admin_audit_logs delete only via purge_audit_logs for rows older than 1 year' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger admin_audit_no_update before update or delete on admin_audit_logs
  for each row execute function admin_audit_guard();
create or replace function purge_audit_logs(p_before timestamptz) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_before > now() - interval '1 year' then raise exception 'p_before must be <= now() - 1 year'; end if;
  perform set_config('tastefit.audit_purge', 'on', true);   -- 이 트랜잭션 안에서만
  delete from admin_audit_logs where created_at < p_before;
  get diagnostics n = row_count;
  perform set_config('tastefit.audit_purge', 'off', true);
  return n;
end $$;
-- 트리거가 행마다 created_at을 다시 확인하므로 p_before 검사를 우회해도 1년 이내 행은 지워지지 않는다.

create table events (                                 -- 00장 8.2 원문 그대로
  event_id         uuid primary key,
  name             text not null,
  ts               timestamptz not null,
  anon_id          text not null,
  user_id          uuid null references users(id) on delete set null,
  session_id       text not null,
  source           text not null check (source in ('client','server')),
  app_version      text not null,
  taxonomy_version text not null,
  device           text not null check (device in ('mobile','tablet','desktop')),
  referrer_host    text null,
  utm              jsonb null,
  is_internal      boolean not null default false,
  props            jsonb not null default '{}'
);
create index on events (name, ts);
create index on events (user_id, ts);
create index on events (anon_id, ts);

create table eval_sets (                              -- ADM-09, 07장 7.8
  id          uuid primary key default gen_random_uuid(),
  protocol    text not null check (protocol in ('P-1','P-2','P-3','P-4','P-5')),
  description text not null,
  config      jsonb not null,                         -- 비교 대상 리포트 ID·models.yaml 리비전
  created_at  timestamptz not null default now()
);
create table eval_judgments (                         -- 00장 IF-07, 07장 7.8
  id            uuid primary key default gen_random_uuid(),
  eval_set_id   uuid not null references eval_sets(id) on delete cascade,
  item_id       text not null,                        -- 쌍 또는 단일 항목 ID
  judge_id      text not null,                        -- 평가자 링크 토큰 해시(개인 식별 없음)
  left_ref      text not null, right_ref text not null,  -- 서버 무작위 배치, seed 기록
  layout_seed   int not null,
  chosen        text null check (chosen in ('left','right','tie')),   -- tie는 선호율 분모 제외(07장 D-0715)
  ai_like_left  boolean null, ai_like_right boolean null,           -- P-1 AI 느낌 판별
  score         smallint null check (score between 1 and 5),        -- P-5 제작자 검수
  latency_ms    int null,
  created_at    timestamptz not null default now(),
  unique (eval_set_id, item_id, judge_id)
);

create table fewshot_examples (                       -- 04장 D-0414, 08장 8.5.2
  id               uuid primary key default gen_random_uuid(),
  origin           text not null check (origin = 'operator'),     -- 'user_consented'는 P2(08장: MVP 코드 경로 없음)
  consent_id       uuid null references consents(id) on delete restrict,
  approved_by      text not null,
  approved_at      timestamptz not null,
  type_id          text not null check (type_id ~ '^T[1-8]$'),
  purpose          text not null check (purpose in ('saas','portfolio','local_business')),
  pattern_id       text not null,                     -- 04장 4.8 패턴
  taxonomy_version text not null references taxonomy_releases(version),
  layout_tree      jsonb not null,                    -- 카피·브랜드명·이미지 슬롯은 플레이스홀더(덱 참조만)
  tokens           jsonb not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create unique index fewshot_one_active on fewshot_examples (taxonomy_version, type_id, purpose, pattern_id) where active;
