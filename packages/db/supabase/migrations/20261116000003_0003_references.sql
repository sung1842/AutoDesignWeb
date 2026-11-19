-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(0003_references). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 0003_references: 컬럼 원본 → 05장 5.3 =====
create table sources (
  source_id            text primary key,              -- 'awwwards', 'site:<eTLD+1>', 'direct'
  kind                 text not null check (kind in ('platform','origin_site','stats')),
  name                 text not null,
  tier                 text not null check (tier in ('T1','T2','T3','AUX')),
  url_pattern          text not null,
  access_method        text not null check (access_method in ('manual','extract','rss','api')),
  tos_url              text null,
  tos_checked_at       date null,
  tos_allows_automated text not null default 'unknown' check (tos_allows_automated in ('yes','no','unknown')),
  robots_checked_at    timestamptz null,
  robots_allows        text not null default 'unknown' check (robots_allows in ('yes','no','unknown')),
  tdm_reserved         boolean null,
  rate_limit_rps       numeric not null default 0.2 check (rate_limit_rps <= 0.2),
  stores_screenshot    boolean not null default false,
  status               text not null check (status in ('active','manual_only','blocked','excluded')),
  note                 text null,
  check (kind = 'origin_site' or stores_screenshot = false),
  check (kind <> 'platform' or tos_allows_automated = 'yes' or status in ('manual_only','blocked','excluded'))
);

create table reference_sites (                        -- 05장 5.3.2(R-18, 구 references)
  id             uuid primary key default gen_random_uuid(),
  url            text not null check (url ~ '^https://'),
  domain         text not null unique,
  title          text not null check (char_length(title) <= 120),   -- LLM 입력 금지(08장 G5)
  title_ko       text null check (char_length(title_ko) <= 40),
  blurb_ko       text null check (char_length(blurb_ko) <= 60),
  type_primary   text null check (type_primary ~ '^T[1-8]$'),
  source_id      text not null references sources(source_id),
  tier           text not null check (tier in ('T1','T2','T3')),
  use            text not null check (use in ('saas','portfolio','local_business')),
  lang           text not null check (lang in ('ko','en')),
  era            text not null check (era in ('current','classic')),
  era_uncertain  boolean not null default false,
  redesigned_at  date null,
  maker          text null,
  status         text not null check (status in ('candidate','screened','captured','labeled','active','observation','retired','excluded')),
  role           text not null check (role in ('seed','observation')),
  season_first   text null,
  seasons_active text[] not null default '{}',
  link_allowed   boolean not null default false,
  phash_1280     bit(64) null,                        -- 스크린샷 삭제 후에도 보관
  flags          text[] not null default '{}',
  collected_at   timestamptz null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (not link_allowed or (status = 'active' and title_ko is not null))
);
create trigger reference_sites_touch before update on reference_sites for each row execute function touch_updated_at();

create table reference_captures (
  id                    uuid primary key default gen_random_uuid(),
  reference_id          uuid not null references reference_sites(id) on delete cascade,
  captured_at           timestamptz not null,
  extractor_version     text not null,
  viewport              text not null default '1280x800',
  status                text not null check (status in ('ok','rejected')),
  reject_reason         text null check (reject_reason in ('http_4xx','http_5xx','robots_disallow','robots_5xx','tdm_reserved',
                          'login_wall','captcha','timeout','blocked_429_403','excluded_category','excluded_domain')),
  screenshot_first_path text null,                    -- ref-screenshots 버킷
  screenshot_full_path  text null,
  screenshot_deleted_at timestamptz null,
  http_status           int null,
  durations_ms          jsonb null
);
create index on reference_captures (captured_at) where screenshot_deleted_at is null;

create table reference_features (
  capture_id      uuid primary key references reference_captures(id) on delete cascade,
  raw             jsonb not null,                     -- F01~F30
  l2_auto         jsonb null,
  originality_sig jsonb null                          -- 08장 8.3 G2 7속성
);                                                    -- embedding·embedding_model은 Phase 2 additive(S-22)
create table normalizers (                            -- version = 시즌 ID(R-30), 패치 '.n'. S0 = temp 합성 부트스트랩 전용(S-09, AD-007)
  version     text primary key check (version ~ '^\d{4}-S[0-4](\.\d+)?$'),
  status      text not null check (status in ('draft','released','superseded')),
  body        jsonb not null,
  corpus_hash text not null,
  released_at timestamptz null
);
-- released 행 UPDATE 금지 트리거(05장 5.3.7)

create table reference_l1 (
  capture_id         uuid not null references reference_captures(id) on delete cascade,
  normalizer_version text not null references normalizers(version),
  vector             jsonb not null check (is_l1(vector)),
  primary key (capture_id, normalizer_version)
);
create table vlm_tags (
  id             uuid primary key default gen_random_uuid(),
  capture_id     uuid not null references reference_captures(id) on delete cascade,
  run_index      smallint not null check (run_index between 1 and 3),
  model_id       text not null, prompt_version text not null,      -- 역할 ref_tagger
  output         jsonb not null,
  created_at     timestamptz not null default now()
);
create table reference_labels (
  id             uuid primary key default gen_random_uuid(),
  reference_id   uuid not null references reference_sites(id) on delete cascade,
  rater_id       text not null check (rater_id in ('op','r2')), session_id text not null,
  purpose        text not null check (purpose in ('primary','retest','inter_rater')),
  axes jsonb not null, l2 jsonb null,                 -- axes 키 R-01, 값 1..5|null
  type_primary text null check (type_primary ~ '^T[1-8]$'),
  type_secondary text null check (type_secondary ~ '^T[1-8]$'),
  checklist jsonb null,
  labeled_at     timestamptz not null default now()
);

create table excluded_domains (
  domain     text primary key,                        -- eTLD+1
  reason     text not null check (reason in ('optout','claim','policy','category','legal','robots')),
  added_at   timestamptz not null default now(),
  request_id uuid null
);

create table rights_requests (                        -- 08장 8.1.6 (opt-out 단일 원본, R-18)
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('optout_domain','copyright_claim','trademark_claim','privacy_request','abuse_report')),
  domain          text null,
  target_url      text null,
  requester_email text not null check (char_length(requester_email) <= 254),
  requester_role  text not null check (requester_role in ('owner','agent','other')),
  details         text not null check (char_length(details) <= 2000),
  status          text not null default 'received' check (status in ('awaiting_verification','received','in_progress','done','rejected')),  -- awaiting_verification = privacy_request 본인 확인 대기(T-16)
  verify_token_hash text null,                        -- SHA-256(1회용 토큰). 메일 privacy_verify 링크(T-16)
  verify_expires_at timestamptz null,                 -- 발급 + 24시간. 만료·재사용 410
  verified_at     timestamptz null,                   -- 미확인 건 처리 시도 409
  received_at     timestamptz not null default now(),
  due_at          timestamptz not null,               -- type별 +7d / +10d / +24h
  closed_at       timestamptz null,
  resolution_note text null,
  check ((verify_token_hash is null) = (verify_expires_at is null))
);
create view optout_requests as                        -- 05장 5.3.8 읽기 전용 뷰
  select id, domain, requester_email as contact, received_at, status, closed_at as completed_at, resolution_note as note
  from rights_requests where type = 'optout_domain';

create view similar_site_candidates as                -- 05장 5.3.9, 사용자 쪽이 읽는 유일한 레퍼런스 뷰
  select r.id, r.domain, r.url, r.title_ko, r.blurb_ko, r.type_primary, r.use, l.vector as l1
  from reference_sites r
  join lateral (select c.id from reference_captures c
                where c.reference_id = r.id and c.status = 'ok'
                order by c.captured_at desc limit 1) c on true
  join reference_l1 l on l.capture_id = c.id
  join normalizers n on n.version = l.normalizer_version and n.status = 'released'
  where r.status = 'active' and r.link_allowed
    and not exists (select 1 from excluded_domains x where x.domain = r.domain);
