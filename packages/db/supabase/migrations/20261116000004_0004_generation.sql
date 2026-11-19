-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(0004_generation). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 0004_generation =====
create table projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id) on delete cascade,
  result_id       uuid null references diagnosis_results(id) on delete set null,
  taste_snapshot  jsonb not null,                     -- TasteResult(04장): {taxonomy_version, mu, sigma, kappa, insensitive_axes, type_id, anchor_override_type_id} 생성 시점 고정
  purpose         text not null check (purpose in ('saas','portfolio','local_business')),  -- D-002
  brand           jsonb not null,                     -- BrandInput(01장 1.5.5.2: name, description, primaryAction, primaryActionLabel?, audience?, keyPoints?, brandColor?), 6.4.5 처리 후
  brand_hash      text not null,                      -- 정규화 브랜드명 SHA-256(차단 로그·중복 탐지)
  use_sample_content boolean not null default false,  -- "예시 콘텐츠로 보기"(MockupCard.useSampleContent)
  brief_draft_id  uuid null,                          -- 임시본에서 제출된 경우(01장 D-0103)
  title           text not null check (char_length(title) between 1 and 60),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on projects (owner_id, created_at desc);
-- 계정당 10개 제한(PROJECT_LIMIT)은 create_project() 함수에서 검사(00장 9.3)

create table generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  owner_id         uuid not null references users(id) on delete cascade,
  kind             text not null check (kind in ('initial','regenerate')),
  job_seed         int not null,
  status           text not null check (status in ('queued','running','succeeded','partial','fallback','failed','canceled')),
  phase            text not null default 'queued' check (phase in ('queued','compiling','generating','rendering','scoring','repairing','fallback','selecting','done')),
  progress_pct     smallint not null default 0 check (progress_pct between 0 and 100),
  idempotency_key  text not null,
  request_id       text not null,                     -- X-Request-Id (6.12 추적)
  config_snapshot  jsonb not null,                    -- 6.9.3
  design_spec      jsonb null,                        -- DesignSpec ×3 변형(→04장)
  copy_deck        jsonb null,                        -- CopyDeck(→04장)
  copy_source      text not null default 'llm' check (copy_source in ('llm','template')),  -- template = gen_copy 실패 시 템플릿 덱(S-12)
  warnings         text[] not null default '{}',     -- 잡 경고 코드(6.4.2): COPY_FALLBACK 등
  n_real           smallint not null default 0 check (n_real between 0 and 3),
  n_fallback       smallint not null default 0 check (n_fallback between 0 and 3),
  repair_rounds    smallint not null default 0 check (repair_rounds between 0 and 1),
  tokens_in        int not null default 0,
  tokens_out       int not null default 0,
  cost_usd         numeric(10,5) not null default 0 check (cost_usd >= 0),  -- IF-02. 상한 CHECK 없음(T-17: 실제 청구는 외부 사실). 0.30(실효 cap) 초과 저장 시 A11 + 그 잡의 이후 예약 거부(6.9.4 ⑥). 옛 S-13 ≤0.36 → T-17로 대체
  error_code       text null,
  error_message    text null check (char_length(error_message) <= 500),
  worker_id        text null,
  queued_at        timestamptz not null default now(),
  started_at       timestamptz null,
  heartbeat_at     timestamptz null,
  finished_at      timestamptz null,
  unique (owner_id, idempotency_key)
);
create unique index gen_one_active_per_user on generation_jobs (owner_id) where status in ('queued','running');
create index on generation_jobs (project_id, queued_at desc);
create index on generation_jobs (status, queued_at);
create index on generation_jobs (kst_day(queued_at));

create table candidates (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references generation_jobs(id) on delete cascade,
  owner_id        uuid not null references users(id) on delete cascade,
  variant         text not null check (variant in ('v_true','v_fit','v_bal')),   -- D-008
  slot            smallint not null check (slot between 0 and 5),      -- candidateIndex = variantIndex × 2 + 패턴 슬롯(04장 4.8, T-18). 재호출·수정도 원 후보와 같은 값
  origin          text not null check (origin in ('llm','repair','diversity','fallback')),  -- diversity = 다양성 위반 재호출(T-18, 04 4.8)
  round           smallint not null default 0 check (round in (0,1)),
  tokens          jsonb not null,                     -- TokenSet(03장)
  layout_tree     jsonb null,                         -- 확정 트리(스키마 실패 시 null). LLM 원문은 llm-payloads에만(04장 D-0416)
  schema_valid    boolean not null,
  quality_report  jsonb null,                         -- QualityReport(게이트·H·TM·린트·originality, →04장 4.10.7)
  harmony_score   smallint null check (harmony_score between 0 and 100),
  taste_score     smallint null check (taste_score between 0 and 100),
  rank_score      real null,
  eligible        boolean not null default false,
  render_hash     text null,
  screenshot_paths jsonb null,                        -- {"1280": path, "375": path} (renders 버킷)
  created_at      timestamptz not null default now()
);
create index on candidates (job_id, variant);
create index on candidates (created_at);

create table mockups (                                -- 노출 시안(잡당 ≤3), 00장 IF-04
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references generation_jobs(id) on delete cascade,
  project_id         uuid not null references projects(id) on delete cascade,
  owner_id           uuid not null references users(id) on delete cascade,
  candidate_id       uuid not null unique references candidates(id) on delete restrict,
  variant            text not null check (variant in ('v_true','v_fit','v_bal')),
  is_fallback        boolean not null,
  current_version_id uuid null,                       -- FK는 아래 ALTER(순환)
  selected_at        timestamptz null,                -- mockup_select
  adopted_at         timestamptz null,                -- 최초 내보내기 성공 또는 공유 공개(00장 6.1)
  adopted_via        text null check (adopted_via in ('export','share')),
  feedback           text null check (feedback in ('up','down')),
  feedback_reason    text null check (feedback_reason in ('ai_feel','not_my_taste','broken_layout','bad_copy','other')),
  feedback_at        timestamptz null,
  followup_answered_at  timestamptz null,             -- A5 채택 후속 응답(T-22). POST /api/mockups/:id/adoption-followup
  followup_dismissed_at timestamptz null,             -- 같은 시트 닫기(answer='dismissed', 이벤트 없음)
  created_at         timestamptz not null default now(),
  unique (job_id, variant),
  check (followup_answered_at is null or followup_dismissed_at is null),
  check ((adopted_at is null) = (adopted_via is null))
);

create table mockup_versions (
  id                uuid primary key default gen_random_uuid(),
  mockup_id         uuid not null references mockups(id) on delete cascade,
  owner_id          uuid not null references users(id) on delete cascade,
  version_no        int not null check (version_no >= 1),
  parent_version_id uuid null references mockup_versions(id) on delete set null,
  change_source     text not null check (change_source in ('select','edit_autosave','edit_manual','pre_export','pre_share','restore')),   -- D-0115 저장 시점
  edit_state        jsonb not null default '{}',      -- EditState(01장 1.8.6): 컨트롤 위치·후보·섹션 순서/숨김·텍스트 + ops(최근 50개, D-0115)
  tokens            jsonb not null,                   -- 이 버전의 전체 TokenSet(diff 아님, D-0614)
  layout_tree       jsonb not null,                   -- 이 버전의 전체 트리(텍스트 수정 반영)
  gate_status       text not null default 'pending' check (gate_status in ('pending','passed','failed')),
  gate_report       jsonb null,                       -- {failed: ['GATE_FAILED:G-04', …], details} (R-13)
  render_hash       text not null,
  thumbnail_path    text null,
  created_at        timestamptz not null default now(),
  unique (mockup_id, version_no)
);
alter table mockups add constraint mockups_current_version_fk
  foreign key (current_version_id) references mockup_versions(id) on delete set null deferrable initially deferred;

create table exports (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references users(id) on delete cascade,
  version_id       uuid not null references mockup_versions(id) on delete cascade,
  format           text not null check (format in ('html_zip','react_zip','dtcg_json')),   -- 00장 export_complete
  status           text not null check (status in ('queued','running','succeeded','failed')),
  idempotency_key  text not null,
  object_path      text null,
  bytes            int null,
  sha256           text null,
  error_code       text null,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz null,
  unique (owner_id, idempotency_key)
);

create table llm_calls (                              -- 00장 IF-02, 08장 P7(PII 없음)
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid null references generation_jobs(id) on delete set null,
  owner_id        uuid null references users(id) on delete set null,
  candidate_id    uuid null,
  role            text not null check (role in ('gen_copy','gen_layout','judge_vision','ref_tagger')),
  call_kind       text not null check (call_kind in ('initial','repair_schema','repair_quality','diversity')),  -- diversity(T-18)
  purpose         text not null default 'user_job' check (purpose in ('user_job','eval','ref_tag')),  -- T-21. eval·ref_tag는 GEN_* 예산과 따로 집계
  processor_id    text not null,                      -- legal/processors.yaml id
  model           text not null,
  prompt_id       text not null,
  prompt_version  int not null,
  prompt_sha256   text not null,
  attempt         smallint not null default 1,
  is_fallback     boolean not null default false,
  mode            text not null check (mode in ('mock','replay','record','live')),
  tokens_in       int not null default 0,
  tokens_out      int not null default 0,
  cached_tokens_in int not null default 0,
  cache_write_tokens_in int not null default 0,      -- T-17: 프롬프트 캐시 쓰기 입력(6.9.4 비용식 cacheWrite)
  cost_usd        numeric(10,5) not null default 0,
  latency_ms      int null,
  started_at      timestamptz not null default now(),  -- U-01: 예약 성공 후 공급자 호출 출발 시각
  first_token_at  timestamptz null,                     -- U-01: 사건 t1(스트리밍 첫 토큰, 비스트리밍·Mock은 응답 완료). budget_skipped는 null
  status          text not null check (status in ('ok','schema_invalid','timeout','rate_limited','provider_error','budget_skipped','aborted','output_rejected','unapproved')),
  error_code      text null,
  request_hash    text not null,
  payload_path    text null,                          -- llm-payloads 버킷(30일)
  created_at      timestamptz not null default now(),
  check (purpose <> 'user_job' or job_id is not null or owner_id is null)   -- user_job은 job_id 필수. 탈퇴 후 set null(job·owner 동시)만 예외
);
create index on llm_calls (job_id);
create index on llm_calls (purpose, kst_day(created_at));
create index on llm_calls (created_at);
create index on llm_calls (kst_day(created_at));

create table quota_ledger (                           -- 00장 9.3
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  job_id     uuid not null references generation_jobs(id) on delete cascade,
  kind       text not null check (kind in ('reserve','refund')),
  created_at timestamptz not null default now(),
  unique (job_id, kind)
);
create index on quota_ledger (user_id, created_at);
