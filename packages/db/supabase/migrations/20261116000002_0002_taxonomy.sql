-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(0002_taxonomy). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 0002_taxonomy: data/ → db:seed 복제본(원본은 data/, →09장 9.2) =====
create table taxonomy_releases (                      -- 시즌(R-30, 05장 D-053)
  version       text primary key check (version ~ '^\d{4}-S[1-4](\.\d+)?$'),  -- 'YYYY-S{1..4}', 패치 '.n'
  status        text not null check (status in ('draft','active','retired')),
  data_checksum text not null,                        -- data/ 묶음 해시
  release_date  date not null,                        -- 분기 첫 월요일
  freeze_date   date not null,                        -- release_date − 14일
  activated_at  timestamptz null,
  created_at    timestamptz not null default now(),
  check (freeze_date = release_date - 14)
);
create unique index taxonomy_one_active on taxonomy_releases ((true)) where status = 'active';

create table types (                                  -- 유형 8개(D-15, R-04). 이름·설명 원본 02장, 중심 벡터 원본 03장 3.4.7
  taxonomy_version text not null references taxonomy_releases(version),
  id               text not null check (id ~ '^T[1-8]$'),     -- type_id
  slug             text not null,
  name_ko          text not null,
  description_ko   text not null,
  centroid         jsonb not null check (is_l1(centroid)),
  anchor_preset_id text not null check (anchor_preset_id ~ '^PS-T[1-8]$'),
  primary key (taxonomy_version, id)
);

create table presets (                                -- →03장
  taxonomy_version text not null references taxonomy_releases(version),
  id               text not null,                     -- 앵커 'PS-T1'~'PS-T8' + 비앵커 프리셋
  type_id          text not null,
  tokens           jsonb not null check (jsonb_typeof(tokens) = 'object'),   -- TokenSet(03장)
  l2               jsonb not null check (jsonb_typeof(l2) = 'object'),       -- 18키(R-27)
  theme            text not null check (theme in ('light','dark')),
  status           text not null check (status in ('draft','approved','needs_review')),
  provenance       jsonb not null,                    -- {origin, domains[]} (08장 8.3 G1)
  primary key (taxonomy_version, id),
  foreign key (taxonomy_version, type_id) references types(taxonomy_version, id)
);

create or replace function is_survey_asset(a jsonb, w int, h int, max_bytes int) returns boolean
language sql immutable as $$
  select jsonb_typeof(a) = 'object'
     and (a->>'w')::int = w and (a->>'h')::int = h
     and (a->>'bytes')::int <= max_bytes
     and a->>'path' ~ '\.webp$' and length(a->>'sha256') = 64
$$;

create table survey_items (                           -- 자극물(D-14, 02장 2.3.6), 생성 → pnpm survey:build
  taxonomy_version text not null references taxonomy_releases(version),
  id               text not null,                     -- 'C-SV{nn}-{tpl}' / 'AB-{T}-{A}-{lv}' / 'ABP-{T}-{A}-{lvA}{lvB}'
  kind             text not null check (kind in ('card','ab_image','ab_pair','anchor_ref')),
  stage            smallint null check (stage in (1,2)),
  template_id      text not null check (template_id in ('tpl-hero','tpl-grid','tpl-text')),
  axis             text null check (axis in ('expression','temperature','shape','density','depth')),
  level            real null check (level in (0.2, 0.5, 0.8)),     -- R-06
  pair_image_ids   text[] null,                       -- ab_pair만: 두 ab_image ID
  target_l1        jsonb null check (target_l1 is null or is_l1(target_l1)),
  x_card           jsonb null check (x_card is null or is_l1(x_card)),   -- 실측 L1(D-0904), ab_pair는 null
  assets           jsonb null,                        -- R-07: {desktop:{path,sha256,w,h,bytes}, mobile:{…}}
  alt_text         text null check (alt_text is null or char_length(alt_text) between 5 and 160),  -- R-07(02장 alt_ko)
  dominant_colors  text[] null check (dominant_colors is null or (cardinality(dominant_colors) = 3
                     and dominant_colors[1] ~ '^#[0-9A-F]{6}$')),   -- R-07, 01장 D-0111
  focus_region     jsonb null,                        -- {x,y,w,h} 0~1 비율(02장 2.4.4)
  status           text not null check (status in ('draft','verified','active','retired')),
  stats            jsonb not null default '{}',       -- 노출 수·선택률·위치별 선택률·cant_tell 비율·flag
  primary key (taxonomy_version, id),
  check (kind = 'ab_pair' or (assets is not null and alt_text is not null and dominant_colors is not null
         and is_survey_asset(assets->'desktop', 1280, 800, 143360)                 -- ≤140KB
         and (kind = 'anchor_ref' or is_survey_asset(assets->'mobile', 780, 1560, 163840)))),   -- ≤160KB
  check ((kind = 'ab_pair') = (pair_image_ids is not null and cardinality(pair_image_ids) = 2))
);

-- ===== 진단(필드 의미 원본 02장 2.3) =====
create table diagnosis_sessions (
  id               uuid primary key default gen_random_uuid(),   -- = 이벤트 survey_session_id
  anon_id          uuid not null,                     -- 쿠키 값(08장 P1)
  user_id          uuid null references users(id) on delete cascade,
  taxonomy_version text not null references taxonomy_releases(version),
  seed             int not null,                      -- CSPRNG 1회 발급
  purpose_hint     text null check (purpose_hint in ('saas','portfolio','local_business')),
  status           text not null check (status in ('in_progress','completed','abandoned')),   -- abandoned = 30분 무활동(02장)
  entry            text not null check (entry in ('landing','share','retest','direct')),
  versions         jsonb not null,                    -- 02장 2.0 버전 4종
  state            jsonb null,                        -- EngineState 캐시(로그 재생으로 언제나 재구성 가능)
  started_at       timestamptz not null default now(),
  last_active_at   timestamptz not null default now(),
  completed_at     timestamptz null,
  check ((status = 'completed') = (completed_at is not null))
);
create index on diagnosis_sessions (anon_id, status);
create index on diagnosis_sessions (user_id);
create unique index diag_one_open_per_anon on diagnosis_sessions (anon_id) where status in ('in_progress','abandoned');

create table survey_answers (                         -- 응답 로그 원본, 추가 전용(02장 2.3.3, R-18)
  id               bigserial primary key,
  session_id       uuid not null references diagnosis_sessions(id) on delete cascade,
  seq              int not null check (seq between 1 and 16),
  question_id      text not null,                     -- 'q-{session}-{seq}-{attempt}'
  stage            smallint not null check (stage in (1,2)),
  kind             text not null check (kind in ('pick4','ab','check')),
  item_id          text not null,
  shown            jsonb not null,                    -- [{option_id, slot}]
  answer           text not null check (answer in ('option','none_of_these','cant_tell')),
  chosen_option_id text null,
  latency_ms       int not null check (latency_ms between 0 and 3600000),
  policy           text not null check (policy in ('dopt','explore','ab_fisher','check')),
  propensity       real not null check (propensity > 0 and propensity <= 1),
  superseded       boolean not null default false,    -- 뒤로가기 취소(D-13)
  ux               jsonb null,                        -- 01장 1.4.12 선택 필드(D-0106)
  client_ts        timestamptz not null,
  server_ts        timestamptz not null default now(),
  unique (session_id, question_id),
  check ((answer = 'option') = (chosen_option_id is not null))
);
create index on survey_answers (session_id, seq);

create table impressions (                            -- 노출 로그(02장 2.3.4). 트렌드 집계 참조 금지(R-35)
  id           bigserial primary key,
  session_id   uuid not null references diagnosis_sessions(id) on delete cascade,
  seq          int not null,
  item_ids     text[] not null,
  slots        smallint[] not null,
  policy       text not null,
  propensity   real not null,
  device_class text not null check (device_class in ('desktop','tablet','mobile')),
  ts           timestamptz not null default now()
);

create table diagnosis_results (                      -- 02장 2.3.5, 00장 IF-05
  id                      uuid primary key default gen_random_uuid(),   -- result_id
  session_id              uuid not null unique references diagnosis_sessions(id) on delete cascade,
  taxonomy_version        text not null,
  type_id                 text not null check (type_id ~ '^T[1-8]$'),
  type_id_second          text null check (type_id_second ~ '^T[1-8]$'),
  is_boundary             boolean not null,
  profile                 jsonb not null,             -- TasteProfile(02장 2.3.1, 축 키 R-01)
  rating                  smallint null check (rating between 1 and 5),
  anchor_override_type_id text null check (anchor_override_type_id ~ '^T[1-8]$'),   -- R-36
  recomputed_from         uuid null references diagnosis_results(id) on delete set null,
  similar_site_ids        uuid[] not null default '{}' check (cardinality(similar_site_ids) <= 3),
  created_at              timestamptz not null default now()
);

create table brief_drafts (                           -- 01장 D-0103, TTL 24시간(R-26)
  id          uuid primary key default gen_random_uuid(),
  anon_id     uuid not null,
  user_id     uuid null references users(id) on delete cascade,   -- 로그인 귀속 시
  result_id   uuid not null references diagnosis_results(id) on delete cascade,
  purpose     text not null check (purpose in ('saas','portfolio','local_business')),
  brand       jsonb not null,                         -- BrandInput, 6.4.5 처리 후(마스킹본)
  use_sample_content boolean not null default false,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  consumed_at timestamptz null                        -- 프로젝트로 제출된 시각
);
create index on brief_drafts (expires_at);
