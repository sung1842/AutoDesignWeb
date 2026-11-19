// M1 수용 테스트 픽스처 헬퍼(ASM-008). 쓰기는 전부 withService(6.3.5 쓰기 원칙). 값은 스키마 제약을 만족하는 최소 임시값.
import { randomBytes, randomUUID } from "node:crypto";
import { type DbPort, type Tx, q } from "../port.js";

export interface Ownership {
  a: string;
  b: string;
  /** 사용자 A 소유 행 id(테이블 → id). */
  owned: Record<string, string>;
}

/** 픽스처 시즌(06장 CHECK `YYYY-S[1-4]`). */
export const FIXTURE_TAXONOMY = "2026-S4";

const id = async (tx: Tx, sql: string, params: unknown[]): Promise<string> =>
  String((await q(tx, `${sql} returning id`, params)).rows[0]?.id);

async function ensureRelease(tx: Tx): Promise<void> {
  await q(
    tx,
    `insert into taxonomy_releases (version, status, data_checksum, release_date, freeze_date)
     values ($1, 'active', 'fixture', date '2026-12-01', date '2026-12-01' - 14)
     on conflict (version) do nothing`,
    [FIXTURE_TAXONOMY],
  );
}

async function createUser(tx: Tx): Promise<string> {
  const uid = randomUUID();
  await q(tx, "insert into auth.users (id, email) values ($1, $2)", [
    uid,
    `${uid}@fixture.invalid`,
  ]);
  await q(tx, "select provision_user($1, false, $2)", [uid, `h-${uid}`]);
  return uid;
}

async function createProject(tx: Tx, ownerId: string): Promise<string> {
  return id(
    tx,
    `insert into projects (owner_id, taste_snapshot, purpose, brand, brand_hash, title)
     values ($1, '{}', 'saas', '{}', 'fixture-hash', '픽스처 프로젝트')`,
    [ownerId],
  );
}

async function createJob(
  tx: Tx,
  ownerId: string,
  status: string,
  costUsd?: number,
): Promise<string> {
  const projectId = await createProject(tx, ownerId);
  return id(
    tx,
    `insert into generation_jobs (project_id, owner_id, kind, job_seed, status, idempotency_key, request_id, config_snapshot, cost_usd)
     values ($1, $2, 'initial', 1, $3, $4, $5, '{}', coalesce($6::numeric, 0))`,
    [projectId, ownerId, status, randomUUID(), randomUUID(), costUsd ?? null],
  );
}

const shareId = (): string => randomBytes(16).toString("base64url").slice(0, 22);

export function seedOwnership(db: DbPort): Promise<Ownership> {
  return db.withService(async (tx) => {
    await ensureRelease(tx);
    const a = await createUser(tx);
    const b = await createUser(tx);
    const owned: Record<string, string> = {};
    const jobId = await createJob(tx, a, "succeeded");
    owned.generation_jobs = jobId;
    owned.projects = String(
      (await q(tx, "select project_id from generation_jobs where id = $1", [jobId])).rows[0]
        ?.project_id,
    );
    owned.candidates = await id(
      tx,
      `insert into candidates (job_id, owner_id, variant, slot, origin, tokens, schema_valid)
       values ($1, $2, 'v_true', 0, 'llm', '{}', true)`,
      [jobId, a],
    );
    owned.mockups = await id(
      tx,
      `insert into mockups (job_id, project_id, owner_id, candidate_id, variant, is_fallback)
       values ($1, $2, $3, $4, 'v_true', false)`,
      [jobId, owned.projects, a, owned.candidates],
    );
    owned.mockup_versions = await id(
      tx,
      `insert into mockup_versions (mockup_id, owner_id, version_no, change_source, tokens, layout_tree, gate_status, render_hash)
       values ($1, $2, 1, 'select', '{}', '{}', 'passed', 'fixture')`,
      [owned.mockups, a],
    );
    owned.share_links = await id(
      tx,
      `insert into share_links (id, target_type, mockup_id, version_id, owner_user_id, is_public)
       values ($1, 'mockup', $2, $3, $4, true)`,
      [shareId(), owned.mockups, owned.mockup_versions, a],
    );
    const anonId = randomUUID();
    owned.diagnosis_sessions = await id(
      tx,
      `insert into diagnosis_sessions (anon_id, user_id, taxonomy_version, seed, status, entry, versions, completed_at)
       values ($1, $2, $3, 1, 'completed', 'landing', '{}', now())`,
      [anonId, a, FIXTURE_TAXONOMY],
    );
    owned.diagnosis_results = await id(
      tx,
      `insert into diagnosis_results (session_id, taxonomy_version, type_id, is_boundary, profile)
       values ($1, $2, 'T1', false, '{}')`,
      [owned.diagnosis_sessions, FIXTURE_TAXONOMY],
    );
    // 사용자 쪽 소유가 아닌(anon·service 전용) 테이블 행: withAnon 0행 검사의 대조군(AC-06-03)
    await q(
      tx,
      `insert into survey_answers (session_id, seq, question_id, stage, kind, item_id, shown, answer, latency_ms, policy, propensity, client_ts)
       values ($1, 1, 'Q1', 1, 'pick4', 'C-SV01-hero', '[]', 'none_of_these', 1200, 'dopt', 1, now())`,
      [owned.diagnosis_sessions],
    );
    await q(
      tx,
      `insert into brief_drafts (anon_id, result_id, purpose, brand) values ($1, $2, 'saas', '{}')`,
      [anonId, owned.diagnosis_results],
    );
    await q(
      tx,
      `insert into sources (source_id, kind, name, tier, url_pattern, access_method, status)
       values ('tmp_src', 'origin_site', '픽스처 출처', 'T1', 'https://*.invalid/*', 'manual', 'active')
       on conflict (source_id) do nothing`,
    );
    await q(
      tx,
      `insert into reference_sites (url, domain, title, source_id, tier, use, lang, era, status, role)
       values ('https://tmp-ref-fixture.invalid/', 'tmp-ref-fixture.invalid', '픽스처', 'tmp_src', 'T1', 'saas', 'ko', 'current', 'candidate', 'seed')`,
    );
    return { a, b, owned };
  });
}

export function insertSurveyItem(
  db: DbPort,
  o: { id: string; xCard: Record<string, number>; desktopBytes?: number },
): Promise<void> {
  const asset = (w: number, h: number, bytes: number) => ({
    path: `survey/${o.id}-${w}.webp`,
    sha256: "0".repeat(64),
    w,
    h,
    bytes,
  });
  return db.withService(async (tx) => {
    await ensureRelease(tx);
    await q(
      tx,
      `insert into survey_items (taxonomy_version, id, kind, stage, template_id, x_card, assets, alt_text, dominant_colors, status)
       values ($1, $2, 'card', 1, 'tpl-hero', $3, $4, '선택지 픽스처 카드', array['#112233','#445566','#778899'], 'draft')`,
      [
        FIXTURE_TAXONOMY,
        o.id,
        JSON.stringify(o.xCard),
        JSON.stringify({
          desktop: asset(1280, 800, o.desktopBytes ?? 1000),
          mobile: asset(780, 1560, 1000),
        }),
      ],
    );
  });
}

export function insertJob(
  db: DbPort,
  o: { ownerId: string; status: string; costUsd?: number },
): Promise<string> {
  return db.withService((tx) => createJob(tx, o.ownerId, o.status, o.costUsd));
}

export function insertAuditLog(db: DbPort, o: { ageDays: number }): Promise<string> {
  return db.withService((tx) =>
    id(
      tx,
      `insert into admin_audit_logs (action, target_type, created_at)
       values ('fixture', 'fixture', now() - make_interval(days => $1))`,
      [o.ageDays],
    ),
  );
}
