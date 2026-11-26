// 04장 4.1 생성 잡 S1~S9(Mock·live 공통 오케스트레이션, ASM-109). M5-06a 범위:
//   S1 명세 ×3 → S2 카피 1 + 레이아웃 6(스키마 수리 1회) → S3 확정 트리 → S4 컴파일 → S5 평가(evaluateCandidate)
//   → S7 비전 채점(기록 전용) → S8 선택·폴백 → S9 저장, R-15 종료 상태.
// 미구현(M5-06b): 다양성 재호출(diversity)·수정 루프(repair_quality)·전 후보 재생성, SLO 타이머(120/180s), 예산 예약(6.9.4).
import { createHash } from "node:crypto";
import {
  compileSpecs,
  expectedSize,
  loadDesignData,
  resolveTree,
  templateDeck,
  buildFallback,
  type DesignData,
  type DesignSpec,
  type RawTree,
} from "@tastefit/design-spec";
import { findRepoRoot } from "@tastefit/config";
import { maskText } from "@tastefit/compliance";
import { q, type DbPort, type Row, type Tx } from "@tastefit/db";
import { CopyDeckSchema, LayoutTreeRawSchema, type DeckPurpose } from "@tastefit/layout-schema";
import {
  createMockProvider,
  loadModels,
  requestHash,
  type CallKind,
  type CacheState,
  type LlmRole,
  type MockProvider,
  type MockResult,
} from "@tastefit/llm";
import { compilePage } from "@tastefit/renderer";
import { qualityColumns, selectVisible, type CandidateScore } from "@tastefit/scoring";
import { evaluateCandidate, type EvaluateOptions } from "../quality/evaluate.js";
import { openHarness, type Harness } from "../render/harness.js";

const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
type Variant = (typeof VARIANTS)[number];
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

export interface GenerationDeps {
  db: DbPort;
  harness: Harness;
  provider?: MockProvider;
  now?: () => Date;
  axe?: EvaluateOptions["axe"];
}

export const openPipelineHarness = (): Promise<Harness> => openHarness();

let DATA: DesignData | null = null;
const data = (): DesignData => (DATA ??= loadDesignData(findRepoRoot()));

/** 6.9.4 비용식(호출마다 소수 5자리 half-up). */
function costOf(role: LlmRole, r: Extract<MockResult, { kind: "ok" }>): number {
  const m = loadModels();
  const p =
    m.pricing[
      role === "judge_vision" || role === "ref_tagger" ? "mock/mock-vision" : "mock/mock-page"
    ];
  if (!p) return 0;
  const u = r.usage;
  const raw =
    ((u.tokensIn / 1e6) * p.input_per_mtok +
      (u.cachedTokensIn / 1e6) * p.cached_input_per_mtok +
      (u.cacheWriteTokensIn / 1e6) * p.cache_write_per_mtok +
      (u.tokensOut / 1e6) * p.output_per_mtok +
      u.images * p.per_image) *
    r.priceMultiplier;
  return Math.round(raw * 1e5 + Number.EPSILON) / 1e5;
}
const STATUS_OF: Record<MockResult["kind"], string> = {
  ok: "ok",
  rate_limited: "rate_limited",
  provider_error: "provider_error",
  refused: "output_rejected",
  aborted: "timeout",
};

interface Ctx {
  d: GenerationDeps;
  job: Row;
  project: Row;
  provider: MockProvider;
  snapshot: Obj;
}

/** 호출 1회 + llm_calls 1행. */
async function invoke(
  x: Ctx,
  o: {
    role: LlmRole;
    callKind: CallKind;
    candidateIndex: number | null;
    candidateId?: string | null;
    input: unknown;
    attempt?: number;
    isFallback?: boolean;
    cacheState?: CacheState;
  },
): Promise<MockResult> {
  const started = new Date();
  const ac = new AbortController();
  let r: MockResult;
  let thrown: string | null = null;
  try {
    r = await x.provider.complete({
      role: o.role,
      callKind: o.callKind,
      candidateIndex: o.candidateIndex,
      attempt: o.attempt ?? 1,
      input: o.input,
      signal: ac.signal,
      ...(o.cacheState ? { cacheState: o.cacheState } : {}),
    });
  } catch (e) {
    // 공급자 예외는 호출 실패로 기록하고 잡은 계속(AC-04-22 처리되지 않은 예외 0)
    thrown = (e as { code?: string }).code ?? "E_PROVIDER";
    r = { kind: "provider_error", httpStatus: 0 };
  }
  const roles = (x.snapshot.roles ?? {}) as Record<string, Obj>;
  const rs = roles[o.role] ?? {};
  const ok = r.kind === "ok" ? r : null;
  await x.d.db.withService((tx) =>
    q(
      tx,
      `insert into llm_calls (job_id, owner_id, candidate_id, role, call_kind, purpose, processor_id, model, prompt_id, prompt_version,
         prompt_sha256, attempt, is_fallback, mode, tokens_in, tokens_out, cached_tokens_in, cache_write_tokens_in, cost_usd, latency_ms,
         started_at, first_token_at, status, error_code, request_hash)
       values ($1,$2,$3,$4,$5,'user_job',$6,$7,$8,$9,$10,$11,$12,'mock',$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        x.job.id,
        x.job.owner_id,
        o.candidateId ?? null,
        o.role,
        o.callKind,
        String(rs.processorId ?? "mock"),
        o.isFallback
          ? `${String(rs.model ?? "mock-page")}#fallback`
          : String(rs.model ?? "mock-page"),
        String(rs.promptId ?? o.role),
        Number(rs.promptVersion ?? 1),
        String(rs.promptSha256 ?? ""),
        o.attempt ?? 1,
        o.isFallback === true,
        ok?.usage.tokensIn ?? 0,
        ok?.usage.tokensOut ?? 0,
        ok?.usage.cachedTokensIn ?? 0,
        ok?.usage.cacheWriteTokensIn ?? 0,
        ok ? costOf(o.role, ok) : 0,
        ok?.latencyMs ?? null,
        started.toISOString(),
        ok ? new Date().toISOString() : null,
        STATUS_OF[r.kind],
        r.kind === "ok" ? null : (thrown ?? r.kind),
        requestHash(o.role, `${o.role}@v${Number(rs.promptVersion ?? 1)}`, o.input ?? null),
      ],
    ),
  );
  return r;
}
const setJob = (db: DbPort, id: unknown, fields: Obj): Promise<unknown> => {
  const keys = Object.keys(fields);
  return db.withService((tx) =>
    q(
      tx,
      `update generation_jobs set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`,
      [id, ...keys.map((k) => fields[k])],
    ),
  );
};

/** LLM 카피 출력 정리: URL 제거·PII 마스킹(08장 8.7.5 LLM 출력 슬롯, TC-S-11). */
function sanitizeDeck(v: unknown): unknown {
  if (typeof v === "string")
    return maskText(
      v
        .replace(/https?:\/\/\S+|www\.\S+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    );
  if (Array.isArray(v)) return v.map(sanitizeDeck);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitizeDeck(x)]));
  return v;
}
const parseJson = (t: string): unknown => {
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return undefined;
  }
};

/** S2 카피: initial → repair_schema 1회 → fallback 모델 1회(잡 경과 ≤ 60s) → 템플릿 덱(4.7.1·S-12). refused면 null. */
async function copyDeck(
  x: Ctx,
  brand: Obj,
  purpose: DeckPurpose,
): Promise<{ deck: Obj; source: "llm" | "template" } | "refused"> {
  const input = { brand, purpose };
  const schema = CopyDeckSchema(purpose);
  const tries: { callKind: CallKind; isFallback: boolean }[] = [
    { callKind: "initial", isFallback: false },
    { callKind: "repair_schema", isFallback: false },
    { callKind: "initial", isFallback: true },
  ];
  for (const t of tries) {
    const r = await invoke(x, { role: "gen_copy", candidateIndex: null, input, ...t });
    if (r.kind === "refused") return "refused";
    if (r.kind !== "ok") continue;
    const p = schema.safeParse(parseJson(r.text));
    if (p.success) return { deck: sanitizeDeck(p.data) as Obj, source: "llm" };
  }
  const deck = templateDeck(purpose, data().root, {
    name: String(brand.name ?? ""),
    description: String(brand.description ?? ""),
    key_points: Array.isArray(brand.keyPoints) ? (brand.keyPoints as string[]) : [],
  });
  return { deck: deck as unknown as Obj, source: "template" };
}

interface Cand {
  id: string;
  slot: number;
  variant: Variant;
  spec: DesignSpec;
  valid: boolean;
  tree: unknown;
  html: string;
  cols: ReturnType<typeof qualityColumns> | null;
}

async function insertCandidate(
  x: Ctx,
  c: { slot: number; variant: Variant; spec: DesignSpec; origin: string; round: number },
): Promise<string> {
  const r = await x.d.db.withService((tx) =>
    q(
      tx,
      `insert into candidates (job_id, owner_id, variant, slot, origin, round, tokens, schema_valid)
       values ($1, $2, $3, $4, $5, $6, $7, false) returning id`,
      [
        x.job.id,
        x.job.owner_id,
        c.variant,
        c.slot,
        c.origin,
        c.round,
        JSON.stringify(c.spec.tokens),
      ],
    ),
  );
  return String(r.rows[0]?.id);
}

/** S3~S5: 원시 트리 → 확정 트리 → 컴파일 → 평가 → candidates 갱신. */
async function evaluate(
  x: Ctx,
  c: Cand,
  raw: RawTree | null,
  deck: Obj,
  brand: Obj,
  fallback = false,
): Promise<void> {
  const D = data();
  if (raw) {
    c.tree = resolveTree(raw, D, {
      deck: deck as never,
      brand: {
        name: String(brand.name ?? ""),
        description: String(brand.description ?? ""),
        key_points: Array.isArray(brand.keyPoints) ? (brand.keyPoints as string[]) : [],
      },
      seed: `${c.spec.spec_id}:${c.slot}`,
      navVariant: c.spec.layout_constraints.allowed_variants.nav?.[0] ?? "nav.split",
      mediaMode: String(c.spec.l2["media.mode"]),
      budget: { tokens: c.spec.tokens, sizeOf: expectedSize },
    });
  }
  let report;
  try {
    c.html = compilePage(c.spec, c.tree, D).html;
    ({ report } = await evaluateCandidate(
      x.d.harness,
      { spec: c.spec, tree: c.tree, html: c.html },
      D,
      {
        brand,
        candidateId: c.id,
        fallback,
        origin: fallback ? "fallback" : "llm",
        ...(x.d.axe ? { axe: x.d.axe } : {}),
      },
    ));
  } catch (e) {
    // 컴파일·렌더 실패 후보는 노출 불가(RENDER_ERROR), 잡은 계속
    process.stderr.write(
      `[generation] ${String(c.id)} RENDER_ERROR ${String((e as Error).message ?? e)}\n`,
    );
    c.valid = false;
    return;
  }
  c.cols = qualityColumns(report);
  c.valid = true;
  await x.d.db.withService((tx) =>
    q(
      tx,
      `update candidates set layout_tree = $2, schema_valid = true, quality_report = $3, harmony_score = $4, taste_score = $5,
         rank_score = $6, eligible = $7, render_hash = $8 where id = $1`,
      [
        c.id,
        JSON.stringify(c.tree),
        JSON.stringify(c.cols?.quality_report),
        c.cols?.harmony_score,
        c.cols?.taste_score,
        c.cols?.rank_score,
        c.cols?.eligible,
        createHash("sha256").update(c.html).digest("hex"),
      ],
    ),
  );
}

/** 4.12 R-15. 템플릿 덱이면 succeeded 대신 partial(S-12). */
export function jobStatus(nReal: number, nFallback: number, template: boolean): string {
  const s =
    nReal === 3 ? "succeeded" : nReal >= 1 ? "partial" : nFallback >= 1 ? "fallback" : "failed";
  return template && s === "succeeded" ? "partial" : s;
}

/** 잡 1건 실행. 예상 밖 예외는 잡을 failed(RENDER_ERROR)로 닫고 돌려준다(무한 대기·미처리 예외 0, AC-04-22). */
export async function runGenerationJob(
  d: GenerationDeps,
  jobId: string,
): Promise<{ status: string }> {
  try {
    return await runJob(d, jobId);
  } catch (e) {
    process.stderr.write(`[generation] ${jobId} ${String((e as Error).stack ?? e)}\n`);
    await setJob(d.db, jobId, {
      status: "failed",
      phase: "done",
      error_code: "RENDER_ERROR",
      error_message: String((e as Error).message ?? e).slice(0, 500),
      finished_at: (d.now?.() ?? new Date()).toISOString(),
      progress_pct: 100,
    });
    return { status: "failed" };
  }
}

async function runJob(d: GenerationDeps, jobId: string): Promise<{ status: string }> {
  const now = (): string => (d.now?.() ?? new Date()).toISOString();
  const jr = await d.db.withService((tx) =>
    q(tx, "select * from generation_jobs where id = $1", [jobId]),
  );
  const job = jr.rows[0];
  if (!job) throw new Error(`job 없음 ${jobId}`);
  if (job.status !== "queued") return { status: String(job.status) };
  const pr = await d.db.withService((tx) =>
    q(tx, "select * from projects where id = $1", [job.project_id]),
  );
  const project = pr.rows[0] ?? {};
  const snapshot = (job.config_snapshot ?? {}) as Obj;
  const provider =
    d.provider ??
    createMockProvider({ scenario: (snapshot.mockScenario as string | undefined) ?? undefined });
  const x: Ctx = { d, job, project, provider, snapshot };
  const D = data();
  const purpose = String(project.purpose) as DeckPurpose;
  const brand = (project.brand ?? {}) as Obj;
  const taste = project.taste_snapshot as Obj;
  await setJob(d.db, jobId, {
    status: "running",
    phase: "compiling",
    started_at: now(),
    progress_pct: 5,
  });

  // S1
  const specs = compileSpecs(
    {
      taste: taste as never,
      purpose,
      brand: brand.brandColor ? ({ brand_color: brand.brandColor } as never) : null,
      jobSeed: String(job.job_seed),
    },
    D,
  );
  const snap2 = {
    ...snapshot,
    taxonomyVersion: D.taxonomyVersion,
    normalizerVersion: String((taste.taxonomy_version as string | undefined) ?? D.taxonomyVersion),
    rendererVersion: "1",
    compilerVersion: "1",
    originalityVersion: String(snapshot.originalitySha256 ?? ""),
  };
  x.snapshot = snap2;
  await setJob(d.db, jobId, {
    design_spec: JSON.stringify(specs),
    config_snapshot: JSON.stringify(snap2),
    phase: "generating",
    progress_pct: 15,
  });

  // S2 카피
  const copy = await copyDeck(x, brand, purpose);
  if (copy === "refused") {
    await setJob(d.db, jobId, {
      status: "failed",
      phase: "done",
      error_code: "BLOCKED_BRAND",
      error_message: "content_policy: 공급자 안전 거부",
      finished_at: now(),
      progress_pct: 100,
    });
    return { status: "failed" };
  }
  const warnings = copy.source === "template" ? ["COPY_FALLBACK"] : [];
  await setJob(d.db, jobId, {
    copy_deck: JSON.stringify(copy.deck),
    copy_source: copy.source,
    warnings,
    progress_pct: 30,
  });

  // S2 레이아웃 6 + 스키마 수리
  const cands: Cand[] = [];
  for (let i = 0; i < VARIANTS.length * 2; i++) {
    const variant = VARIANTS[Math.floor(i / 2)] ?? "v_true";
    const spec = specs[variant];
    const id = await insertCandidate(x, { slot: i, variant, spec, origin: "llm", round: 0 });
    const c: Cand = { id, slot: i, variant, spec, valid: false, tree: null, html: "", cols: null };
    const input = { spec, purpose, brand, deck: copy.deck };
    let raw: RawTree | null = null;
    for (const callKind of ["initial", "repair_schema"] as const) {
      const r = await invoke(x, {
        role: "gen_layout",
        callKind,
        candidateIndex: i,
        candidateId: id,
        input,
        cacheState: i === 0 ? "cache_write" : "cached",
      });
      if (r.kind !== "ok") break;
      const p = LayoutTreeRawSchema.safeParse(parseJson(r.text));
      if (p.success) {
        raw = p.data as unknown as RawTree;
        break;
      }
    }
    cands.push(c);
    if (raw) await evaluate(x, c, raw, copy.deck, brand);
  }
  await setJob(d.db, jobId, { phase: "scoring", progress_pct: 70 });

  // S7 비전 채점(기록 전용, 변형 내 쌍 × 위치 교환 2회)
  for (const v of VARIANTS) {
    const pair = cands.filter((c) => c.variant === v && c.valid);
    if (pair.length < 2) continue;
    const [a, b] = [pair[0], pair[1]];
    if (!a || !b) continue;
    for (const [p1, p2] of [
      [a, b],
      [b, a],
    ] as const)
      await invoke(x, {
        role: "judge_vision",
        candidateIndex: p1.slot,
        candidateId: p1.id,
        callKind: "initial",
        input: { candidates: [{ id: p1.id }, { id: p2.id }] },
      });
  }

  // S8 선택·폴백
  await setJob(d.db, jobId, { phase: "selecting", progress_pct: 85 });
  const scores: CandidateScore[] = cands
    .filter((c) => c.valid && c.cols)
    .map((c) => ({
      id: c.id,
      variant: c.variant,
      patternSlot: c.slot % 2,
      tm: c.cols?.quality_report.tasteMatch ?? 0,
      harmony: c.cols?.quality_report.harmony ?? 0,
      eligible: c.cols?.eligible === true,
    }));
  const pick = selectVisible(scores);
  let nReal = 0;
  let nFallback = 0;
  for (const v of VARIANTS) {
    let candId = pick[v];
    let isFallback = false;
    if (!candId) {
      await setJob(d.db, jobId, { phase: "fallback" });
      const fb = buildFallback(
        {
          typeId: String(taste.anchor_override_type_id ?? taste.type_id),
          purpose,
          variant: v,
          spec: specs[v],
          brand,
        },
        D,
      );
      const id = await insertCandidate(x, {
        slot: VARIANTS.indexOf(v) * 2,
        variant: v,
        spec: fb.spec,
        origin: "fallback",
        round: 0,
      });
      const c: Cand = {
        id,
        slot: VARIANTS.indexOf(v) * 2,
        variant: v,
        spec: fb.spec,
        valid: false,
        tree: fb.tree,
        html: "",
        cols: null,
      };
      await evaluate(x, c, null, copy.deck, brand, true);
      if (c.cols?.eligible) {
        candId = id;
        isFallback = true;
      }
    }
    if (!candId) continue;
    await d.db.withService((tx: Tx) =>
      q(
        tx,
        `insert into mockups (job_id, project_id, owner_id, candidate_id, variant, is_fallback) values ($1, $2, $3, $4, $5, $6)`,
        [jobId, job.project_id, job.owner_id, candId, v, isFallback],
      ),
    );
    if (isFallback) nFallback++;
    else nReal++;
  }
  const status = jobStatus(nReal, nFallback, copy.source === "template");
  const cost = await d.db.withService((tx) =>
    q(
      tx,
      "select coalesce(sum(cost_usd), 0)::float8 as c, coalesce(sum(tokens_in),0)::int as i, coalesce(sum(tokens_out),0)::int as o from llm_calls where job_id = $1",
      [jobId],
    ),
  );
  await setJob(d.db, jobId, {
    status,
    phase: "done",
    progress_pct: 100,
    n_real: nReal,
    n_fallback: nFallback,
    cost_usd: Number(cost.rows[0]?.c ?? 0),
    tokens_in: Number(cost.rows[0]?.i ?? 0),
    tokens_out: Number(cost.rows[0]?.o ?? 0),
    finished_at: now(),
    ...(status === "failed" ? { error_code: "NO_ELIGIBLE" } : {}),
  });
  return { status };
}
