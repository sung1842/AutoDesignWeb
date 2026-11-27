// 06장 6.4.3 생성 API: POST /api/projects/:id/generations(consent + Idempotency-Key, 6.4.4) → generation_jobs queued,
// GET /api/generations/:jobId(GenerationView·ETag·304). 워커 실행·노출 시안은 M5-07(ASM-108).
import { createHash, randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GenerationReqSchema, IDEMPOTENCY_KEY, type GenerationView } from "@tastefit/api-contract";
import { findRepoRoot } from "@tastefit/config";
import { q, type Row, type Tx } from "@tastefit/db";
import { LLM_ROLES, loadModels, parseMode, parseScenario } from "@tastefit/llm";
import type { Deps } from "./api";
import { requireConsent, requireUser } from "./auth";
import { serverEvent } from "./events";
import { ApiError, ensureAnon, finish, json, parsed, readJson, type Ctx } from "./http";
import { QUOTA_DEFAULTS, admitGeneration, quotaOf, rateLimit, rejected } from "./quota";
import { currentSeason } from "./survey";

const ROUTE = "POST /api/projects/:id/generations";
/** ASM-108 ⑧ 폴링 간격. */
const POLL_AFTER_MS = 1000;
const ACTIVE = new Set(["queued", "running"]);
const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");
const iso = (v: unknown): string | null => (v ? new Date(String(v)).toISOString() : null);
const fileSha = (rel: string): string | null => {
  const p = join(findRepoRoot(), rel);
  return existsSync(p) ? sha256(readFileSync(p)) : null;
};

/** 06장 6.9.3 config_snapshot(잡 생성 시 고정). mock이면 공급자 = mock(9.6.2). */
function configSnapshot(scenario: string | null): Record<string, unknown> {
  const mode = parseMode(process.env.LLM_MODE);
  const m = loadModels();
  const roles = Object.fromEntries(
    LLM_ROLES.map((role) => {
      const r = m.roles[role];
      const mock = mode === "mock";
      return [
        role,
        {
          processorId: mock ? "mock" : r.primary.processor_id,
          model: mock
            ? role === "judge_vision" || role === "ref_tagger"
              ? "mock-vision"
              : "mock-page"
            : r.primary.model,
          promptId: r.prompt.id,
          promptVersion: r.prompt.version,
          promptSha256: fileSha(`packages/llm/prompts/${r.prompt.id}@v${r.prompt.version}.md`),
        },
      ];
    }),
  );
  return {
    modelsRevision: m.revision,
    roles,
    thresholdsSha256: fileSha("config/thresholds.json"),
    originalitySha256: fileSha("config/originality.json"),
    flags: { JUDGE_VISION_MODE: process.env.JUDGE_VISION_MODE ?? "log" },
    llmMode: mode,
    ...(scenario ? { mockScenario: scenario } : {}),
  };
}

/** x-mock-scenario: LLM_MODE=mock ∧ NODE_ENV≠production에서만(9.6.2). 모르는 값은 400. */
function mockScenarioOf(c: Ctx): string | null {
  const h = c.req.headers.get("x-mock-scenario");
  if (!h) return null;
  if (parseMode(process.env.LLM_MODE) !== "mock" || process.env.NODE_ENV === "production")
    throw new ApiError("VALIDATION_FAILED", "x-mock-scenario not allowed", {
      issues: [{ path: "headers.x-mock-scenario", code: "not_allowed" }],
    });
  try {
    parseScenario(h);
  } catch {
    throw new ApiError("VALIDATION_FAILED", "unknown scenario", {
      issues: [{ path: "headers.x-mock-scenario", code: "unknown" }],
    });
  }
  return h;
}

type Obj = Record<string, unknown>;
const at = (o: unknown, ...p: string[]): unknown =>
  p.reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Obj)[k] : undefined), o);
/** 04장 4.4 L2 차이 7키(S-32). depth = style|shadow_level, hero = hero_variants, signature = id. */
function diffVector(spec: unknown): Record<string, string> {
  const l2 = (at(spec, "l2") ?? {}) as Record<string, string>;
  return {
    "type.pairing_id": l2["type.pairing_id"] ?? "",
    "color.palette_id": l2["color.palette_id"] ?? "",
    "shape.radius_family": l2["shape.radius_family"] ?? "",
    depth: `${l2["depth.style"] ?? ""}|${l2["depth.shadow_level"] ?? ""}`,
    "space.density": l2["space.density"] ?? "",
    hero: ((at(spec, "layout_constraints", "hero_variants") as string[] | undefined) ?? []).join(
      ",",
    ),
    signature: String(at(spec, "signature", "id") ?? ""),
  };
}
/** mockups 행 → MockupCard(06장 6.4.3). previewUrl·screenshotUrl은 미리보기 배선(M5-09) 전까지 빈 문자열(ASM-109 ⑤). */
async function cardsOf(tx: Tx, job: Row): Promise<GenerationView["mockups"]> {
  const r = await q(
    tx,
    `select m.id, m.variant, m.is_fallback, c.harmony_score, c.taste_score, c.layout_tree, p.use_sample_content
       from mockups m join candidates c on c.id = m.candidate_id join projects p on p.id = m.project_id
      where m.job_id = $1 order by array_position(array['v_true','v_fit','v_bal'], m.variant)`,
    [job.id],
  );
  const specs = (job.design_spec ?? {}) as Record<string, unknown>;
  const base = diffVector(specs.v_true);
  return r.rows.map((m) => {
    const v = String(m.variant) as "v_true" | "v_fit" | "v_bal";
    const spec = specs[v];
    const moved = (
      (at(spec, "calibration_trace", "moved_axes") as
        { axis: string; from: number; to: number; reason: string }[] | undefined) ?? []
    )
      .slice()
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
      .slice(0, 2)
      .map((x) => ({
        axis: x.axis as "expression",
        direction: x.to > x.from ? ("up" as const) : ("down" as const),
        reason: x.reason as "type",
      }));
    const dv = diffVector(spec);
    return {
      mockupId: String(m.id),
      variant: v,
      isFallback: m.is_fallback === true,
      harmonyScore: Number(m.harmony_score ?? 0),
      tasteScore: Number(m.taste_score ?? 0),
      previewUrl: "",
      screenshotUrl: "",
      labelKey: `variant.${v}` as const,
      // 4.9.4: 이 페이지의 사진 슬롯 중 색면으로 대체된 것이 있으면 true(트리 image.substituted)
      photoSubstituted: JSON.stringify(m.layout_tree ?? null).includes('"substituted":true'),
      brandColorNotice:
        (at(spec, "brand_color_notice") as
          GenerationView["mockups"][number]["brandColorNotice"] | undefined) ?? null,
      useSampleContent: m.use_sample_content === true,
      movedAxes: moved,
      diffFromTrue: v === "v_true" ? [] : Object.keys(dv).filter((k) => dv[k] !== base[k]),
    };
  });
}

/** 잡 행 → GenerationView. queuePosition = 더 이른 queued 잡 수 + 1(6.4.3). */
export async function viewOf(tx: Tx, job: Row): Promise<GenerationView> {
  const status = String(job.status) as GenerationView["status"];
  let queuePosition: number | null = null;
  if (status === "queued") {
    const r = await q(
      tx,
      "select count(*)::int as n from generation_jobs where status = 'queued' and (queued_at, id) < ($1, $2)",
      [job.queued_at, job.id],
    );
    queuePosition = Number(r.rows[0]?.n ?? 0) + 1;
  }
  return {
    jobId: String(job.id),
    status,
    phase: String(job.phase) as GenerationView["phase"],
    progressPct: Number(job.progress_pct ?? 0),
    queuePosition,
    queuedAt: iso(job.queued_at) ?? "",
    startedAt: iso(job.started_at),
    finishedAt: iso(job.finished_at),
    mockups: await cardsOf(tx, job),
    errorCode: (job.error_code as string | null) ?? null,
    pollAfterMs: ACTIVE.has(status) ? POLL_AFTER_MS : null,
    copySource: job.copy_deck ? (String(job.copy_source) as "llm" | "template") : null,
  };
}
export const etagOf = (v: GenerationView): string =>
  `"${createHash("sha1").update(`${v.status}:${v.phase}:${v.progressPct}:${v.mockups.length}`).digest("hex")}"`;

export async function createGeneration(c: Ctx, d: Deps, projectId: string): Promise<Response> {
  const u = await requireConsent(c, d);
  const key = c.req.headers.get("idempotency-key");
  if (!key) throw new ApiError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
  if (!IDEMPOTENCY_KEY.test(key))
    throw new ApiError("VALIDATION_FAILED", "bad Idempotency-Key", {
      issues: [{ path: "headers.idempotency-key", code: "format" }],
    });
  const body = parsed(GenerationReqSchema.safeParse(await readJson(c)));
  const scenario = mockScenarioOf(c);
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new ApiError("NOT_FOUND", "no project");
  const reqSha = sha256(JSON.stringify([projectId, body.kind, scenario]));
  const owner = `u:${u.id}`;
  const now = d.now?.() ?? new Date();
  const anon = ensureAnon(c);
  const out = await d.db.withService(async (tx) => {
    const st = await q(tx, "select status from users where id = $1", [u.id]);
    if (st.rows[0]?.status !== "active")
      throw new ApiError("ACCOUNT_SUSPENDED", "account suspended");
    const p = await q(
      tx,
      "select id, purpose, result_id from projects where id = $1 and owner_id = $2",
      [projectId, u.id],
    );
    const proj = p.rows[0];
    if (!proj) throw new ApiError("NOT_FOUND", "no project");
    // 6.3.4 create_generation_job ①: 사용자 잠금. 6.4.4 멱등: 같은 키는 저장 응답 재생(레이트리밋·한도에 세지 않음)
    await q(tx, "select pg_advisory_xact_lock(hashtext($1))", [u.id]);
    const prev = await q(
      tx,
      "select request_sha256, status_code, response_body from idempotency_keys where owner_key = $1 and route = $2 and key = $3",
      [owner, ROUTE, key],
    );
    const hit = prev.rows[0];
    if (hit) {
      if (hit.request_sha256 !== reqSha)
        throw new ApiError("IDEMPOTENCY_KEY_REUSED", "same key, different body");
      const jobId = String((hit.response_body as { jobId?: string } | null)?.jobId ?? "");
      const j = await q(tx, "select * from generation_jobs where id = $1", [jobId]);
      if (j.rows[0]) return { view: await viewOf(tx, j.rows[0]) };
      throw new ApiError("JOB_IN_PROGRESS", "request in progress", { jobId });
    }
    let qv;
    try {
      await rateLimit(tx, `gen:min:u:${u.id}`, 60, QUOTA_DEFAULTS.genMinPerUser, now);
      qv = await admitGeneration(tx, u.id, now);
      const active = await q(
        tx,
        "select id from generation_jobs where owner_id = $1 and status in ('queued','running') limit 1",
        [u.id],
      );
      if (active.rows[0])
        throw new ApiError("JOB_IN_PROGRESS", "job in progress", {
          jobId: String(active.rows[0].id),
        });
    } catch (e) {
      // 거부도 기록이 남아야 하므로(레이트리밋 카운터·generate_rejected) 커밋하고 트랜잭션 밖에서 던진다
      if (e instanceof ApiError) {
        await rejected(tx, anon, u.id, e.code);
        return { err: e };
      }
      throw e;
    }
    const job = await q(
      tx,
      `insert into generation_jobs (project_id, owner_id, kind, job_seed, status, phase, idempotency_key, request_id, config_snapshot, queued_at)
       values ($1, $2, $3, $4, 'queued', 'queued', $5, $6, $7, $8) returning *`,
      [
        projectId,
        u.id,
        body.kind,
        randomInt(0, 2 ** 31 - 1),
        key,
        c.requestId,
        JSON.stringify(configSnapshot(scenario)),
        now.toISOString(),
      ],
    );
    const row = job.rows[0];
    if (!row) throw new ApiError("INTERNAL", "job insert");
    await q(
      tx,
      "insert into quota_ledger (user_id, job_id, kind, created_at) values ($1, $2, 'reserve', $3)",
      [u.id, row.id, now.toISOString()],
    );
    const v = await viewOf(tx, row);
    await q(
      tx,
      `insert into idempotency_keys (owner_key, route, key, request_sha256, status_code, response_body)
       values ($1, $2, $3, $4, 202, $5)`,
      [owner, ROUTE, key, reqSha, JSON.stringify({ jobId: v.jobId })],
    );
    if (proj.result_id)
      await serverEvent(tx, {
        name: "generate_request",
        anonId: anon,
        userId: u.id,
        tv: await currentSeason(tx),
        props: {
          job_id: v.jobId,
          project_id: projectId,
          purpose: String(proj.purpose),
          result_id: String(proj.result_id),
          quota_remaining_day: Math.max(0, qv.dayLimit - qv.dayUsed - 1),
          quota_remaining_month: Math.max(0, qv.monthLimit - qv.monthUsed - 1),
          queue_position: v.queuePosition ?? 0,
        },
      });
    return { view: v };
  });
  if ("err" in out) throw out.err;
  const view = out.view;
  return json(c, 202, view);
}

export async function getGeneration(c: Ctx, d: Deps, jobId: string): Promise<Response> {
  const u = await requireUser(c, d);
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new ApiError("NOT_FOUND", "no job");
  const v = await d.db.withService(async (tx) => {
    const j = await q(tx, "select * from generation_jobs where id = $1 and owner_id = $2", [
      jobId,
      u.id,
    ]);
    if (!j.rows[0]) throw new ApiError("NOT_FOUND", "no job");
    return viewOf(tx, j.rows[0]);
  });
  const etag = etagOf(v);
  if (c.req.headers.get("if-none-match") === etag)
    return finish(c, new Response(null, { status: 304, headers: { etag } }));
  const res = json(c, 200, v);
  res.headers.set("etag", etag);
  return res;
}

/** POST /api/generations/:jobId/cancel(6.2.3 취소 처리 규칙, T-20). */
export async function cancelGeneration(c: Ctx, d: Deps, jobId: string): Promise<Response> {
  const u = await requireUser(c, d);
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new ApiError("NOT_FOUND", "no job");
  const now = d.now?.() ?? new Date();
  const refunded = await d.db.withService(async (tx) => {
    await q(tx, "select pg_advisory_xact_lock(hashtext($1))", [u.id]);
    const j = (
      await q(tx, "select * from generation_jobs where id = $1 and owner_id = $2 for update", [
        jobId,
        u.id,
      ])
    ).rows[0];
    if (!j) throw new ApiError("NOT_FOUND", "no job");
    if (!ACTIVE.has(String(j.status)))
      throw new ApiError("JOB_ALREADY_FINISHED", "job finished", { status: String(j.status) });
    const left = (await quotaOf(tx, u.id, now)).refundableCancelsLeft;
    await q(
      tx,
      "update generation_jobs set status = 'canceled', phase = 'done', finished_at = $2 where id = $1",
      [jobId, now.toISOString()],
    );
    if (Number(j.n_real) >= 1 || left <= 0) return false;
    await q(
      tx,
      "insert into quota_ledger (user_id, job_id, kind, created_at) values ($1, $2, 'refund', $3) on conflict (job_id, kind) do nothing",
      [u.id, jobId, now.toISOString()],
    );
    return true;
  });
  return json(c, 202, { refunded });
}
