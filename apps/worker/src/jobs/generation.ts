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
  industryTags,
  maxCharsJob,
  type DesignData,
  type DesignSpec,
  type RawTree,
} from "@tastefit/design-spec";
import { findRepoRoot, thresholdNumber } from "@tastefit/config";
import { maskText } from "@tastefit/compliance";
import { flagValue, q, type DbPort, type Row, type Tx } from "@tastefit/db";
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
  type MockUsage,
} from "@tastefit/llm";
import { compilePage } from "@tastefit/renderer";
import {
  createJobBudget,
  diversityViolations,
  type JobBudget,
  type SeqInfo,
} from "@tastefit/pipeline";
import { qualityColumns, selectVisible, type CandidateScore } from "@tastefit/scoring";
import { evaluateCandidate, type EvaluateOptions } from "../quality/evaluate.js";
import { openHarness, type Harness } from "../render/harness.js";
import { finishGenerationJob } from "./finish.js";

const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
/** 4.11.2 사양 상수: 잡당 레이아웃 repair_quality 상한(AC-04-23). */
const REPAIR = { maxCallsPerJob: 3 } as const;
/** 6.9.4 ③ 사양 상수: 실측 입력 토큰 안전 계수. */
const ESTIMATE = { inputSafety: 1.1 } as const;
/** 6.10.4 JOB_COST_CAP_USD 기본값. */
const JOB_CAP_DEFAULT = 0.3;
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
  budget: JobBudget;
  /** 예산으로 호출을 생략한 적이 있으면 잡 오류 코드 COST_CAP(종료 상태와 별개, 6.4.2). */
  costCapped: boolean;
  /** usage_overrun A11(잡당 1회, 6.9.4 ⑥). */
  overrunAlerted: boolean;
  /** R-25 SLO: started_at + fallbackAtSec에 abort("slo") — 진행 중 호출은 aborted, 이후 호출은 출발하지 않는다(6.10, AC-06-40). */
  slo: AbortSignal;
}

type CallSpec = {
  role: LlmRole;
  callKind: CallKind;
  candidateIndex: number | null;
  candidateId?: string | null;
  input: unknown;
  attempt?: number;
  isFallback?: boolean;
  cacheState?: CacheState;
  /** 공급자 응답 직후(정산 대기열에 넣은 뒤, 정산 완료 전) 동기 호출 — U-01 사건 t1. */
  onResponse?: (ok: boolean) => void;
};
/** 6.9.4 ③ 추정식: Σ블록(실측 토큰 × 1.1) × 블록 단가 + maxOutputTokens × 출력 단가 + 이미지 × per_image, 소수 5자리 half-up. */
function estimateOf(role: LlmRole, pv: { usage: MockUsage; estimateMultiplier: number }): number {
  const m = loadModels();
  const p =
    m.pricing[
      role === "judge_vision" || role === "ref_tagger" ? "mock/mock-vision" : "mock/mock-page"
    ];
  if (!p) return 0;
  const u = pv.usage;
  const k = ESTIMATE.inputSafety;
  const raw =
    ((u.tokensIn * k * p.input_per_mtok +
      u.cachedTokensIn * k * p.cached_input_per_mtok +
      u.cacheWriteTokensIn * k * p.cache_write_per_mtok +
      m.roles[role].primary.params.maxOutputTokens * p.output_per_mtok) /
      1e6 +
      u.images * p.per_image) *
    pv.estimateMultiplier;
  return Math.round(raw * 1e5 + Number.EPSILON) / 1e5;
}
/** llm_calls 1행. */
async function recordCall(
  x: Ctx,
  o: CallSpec,
  started: Date,
  r: MockResult | { kind: "skipped" },
  errorCode: string | null,
  cost = 0,
  status?: string,
): Promise<void> {
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
        cost,
        ok?.latencyMs ?? (r.kind === "aborted" ? Date.now() - started.getTime() : null),
        started.toISOString(),
        ok ? new Date().toISOString() : null,
        status ?? (r.kind === "skipped" ? "budget_skipped" : STATUS_OF[r.kind]),
        errorCode,
        requestHash(o.role, `${o.role}@v${Number(rs.promptVersion ?? 1)}`, o.input ?? null),
      ],
    ),
  );
}

/** 호출 1회(예약 → 호출 → 정산) + llm_calls 1행. */
/** U-01 두 번째 물결 출발 상한(t0 + 3s, 06장 6.9.4 ③·V-01. 사양 상수). */
const WAVE2_DELAY_MS = 3000;

/** models.yaml 역할별 호출 타임아웃(ms, 6.9.2). 폴백 호출은 첫 폴백 항목 값. */
function callTimeoutMs(o: CallSpec): number {
  const r = loadModels().roles[o.role];
  const e = o.isFallback ? (r.fallbacks[0] ?? r.primary) : r.primary;
  return e.timeout_ms;
}

/** invoke 결과 + 재시도 판단용 표식(skipped = 예산 거부, timedOut = 호출 타임아웃, slo = 잡 SLO). */
type CallResult = MockResult & { skipped?: true; timedOut?: true; slo?: true };

async function invoke(x: Ctx, o: CallSpec): Promise<CallResult> {
  // SLO 이후에는 새 호출을 출발시키지 않는다(폴백 경로, 6.10)
  if (x.slo.aborted) return { kind: "aborted", slo: true };
  const started = new Date();
  const ac = new AbortController();
  // 6.9.4 ③ 추정 → 예약(spent + reserved + est ≤ capEff, ⑤ 단계 생략 기준)
  const pv = x.provider.preview({
    role: o.role,
    callKind: o.callKind,
    candidateIndex: o.candidateIndex,
    attempt: o.attempt ?? 1,
    ...(o.cacheState ? { cacheState: o.cacheState } : {}),
  });
  const est = estimateOf(o.role, pv);
  const hold = await x.budget.reserve(est, { role: o.role, callKind: o.callKind });
  if (!hold.ok) {
    x.costCapped = true;
    await recordCall(
      x,
      o,
      started,
      { kind: "skipped" },
      hold.reason === "cost_cap" ? "COST_CAP" : hold.reason.toUpperCase(),
    );
    return { kind: "provider_error", httpStatus: 0, skipped: true };
  }
  let r: MockResult;
  let thrown: string | null = null;
  const onSlo = (): void => ac.abort("slo");
  x.slo.addEventListener("abort", onSlo, { once: true });
  const tmo = setTimeout(() => ac.abort("timeout"), callTimeoutMs(o));
  tmo.unref();
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
  } finally {
    clearTimeout(tmo);
    x.slo.removeEventListener("abort", onSlo);
  }
  // abort 사유: SLO(잡 120s) = aborted, 호출 타임아웃 = timeout
  const abortStatus =
    r.kind === "aborted" ? (ac.signal.reason === "slo" ? "aborted" : "timeout") : undefined;
  const ok = r.kind === "ok" ? r : null;
  const cost = ok ? costOf(o.role, ok) : 0;
  // ④ settle(실비) | release(usage 없음)
  const settled = ok ? x.budget.settle(hold.id, cost) : Promise.resolve();
  if (!ok) x.budget.release(hold.id);
  o.onResponse?.(ok !== null);
  await settled;
  await recordCall(
    x,
    o,
    started,
    r,
    r.kind === "ok"
      ? null
      : abortStatus === "aborted"
        ? "SLO_ABORT"
        : abortStatus === "timeout"
          ? "TIMEOUT"
          : (thrown ?? r.kind),
    cost,
    abortStatus,
  );
  // ⑥ 실제 청구가 상한을 넘으면 A11 1건(잡당 1회), 이후 예약은 판정식으로 전부 실패
  if (x.budget.spent > x.budget.capEff && !x.overrunAlerted) {
    x.overrunAlerted = true;
    // alerts 테이블은 06장 6.3.3 DDL에 없다(ASM-111 ①): 잡 경고 A11 + 로그로 남기고 관측(M7)에서 알림으로 옮긴다
    process.stderr.write(
      `[alert] A11 job=${String(x.job.id)} spent=${x.budget.spent} capEff=${x.budget.capEff}\n`,
    );
    await x.d.db.withService((tx) =>
      q(
        tx,
        "update generation_jobs set warnings = array_append(warnings, 'A11') where id = $1 and not ('A11' = any(warnings))",
        [x.job.id],
      ),
    );
  }
  return abortStatus === "aborted"
    ? { ...r, slo: true }
    : abortStatus === "timeout"
      ? { ...r, timedOut: true }
      : r;
}

/**
 * 06장 6.9.2 retry(models.yaml): 429는 Retry-After(상한 respect_retry_after_max_ms)만큼 기다려 max회,
 * 5xx·네트워크·타임아웃은 backoff_ms 뒤 max회, 같은 모델 연속 실패가 switch_to_fallback_after_consecutive_failures에
 * 이르면 첫 폴백 모델로 바꾼다(llm_calls.is_fallback). 예산 거부·안전 거부·SLO 중단·성공은 그대로 돌려준다.
 * attempt는 호출마다 1씩 늘린다(재시도마다 새 예약 1개, AC-06-62 ②).
 */
async function callLlm(x: Ctx, o: CallSpec): Promise<CallResult> {
  const m = loadModels();
  const hasFallback = (m.roles[o.role].fallbacks.length ?? 0) > 0;
  let isFallback = o.isFallback === true;
  let attempt = o.attempt ?? 1;
  let consecutive = 0;
  let n429 = 0;
  let n5xx = 0;
  let first = true;
  for (;;) {
    const r = await invoke(x, {
      ...o,
      attempt,
      isFallback,
      ...(first ? {} : { onResponse: undefined }),
    });
    first = false;
    if (r.kind === "ok" || r.kind === "refused" || r.skipped || r.slo) return r;
    let waitMs: number;
    if (r.kind === "rate_limited") {
      if (n429 >= m.retry.rate_limited.max) return r;
      n429++;
      waitMs = Math.min(r.retryAfterMs, m.retry.rate_limited.respect_retry_after_max_ms);
    } else {
      consecutive++;
      if (
        !isFallback &&
        hasFallback &&
        consecutive >= m.retry.switch_to_fallback_after_consecutive_failures
      ) {
        isFallback = true;
        consecutive = 0;
        n5xx = 0;
        attempt++;
        continue;
      }
      if (n5xx >= m.retry.network_or_5xx.max) return r;
      n5xx++;
      waitMs = m.retry.network_or_5xx.backoff_ms;
    }
    if (!(await sleepUnlessAborted(waitMs, x.slo))) return { kind: "aborted", slo: true };
    attempt++;
  }
}
/** SLO 신호로 끊기는 대기. 끝까지 기다렸으면 true. */
function sleepUnlessAborted(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((done) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      done(true);
    }, ms);
    t.unref();
    const stop = (): void => {
      clearTimeout(t);
      done(false);
    };
    signal.addEventListener("abort", stop, { once: true });
  });
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

/** S3 병합 전 검사: 모든 덱 참조(deck:key#i)가 덱 범위 안(범위 밖은 스키마 수리 대상, 9.6.2 mixed 3). */
function deckRefsOk(raw: unknown, deck: Obj): boolean {
  const refs = JSON.stringify(raw).match(/deck:[a-z_.]+#\d/g) ?? [];
  return refs.every((ref) => {
    const m = /^deck:([a-z_.]+)#(\d)$/.exec(ref);
    const list = m ? deck[m[1] ?? ""] : undefined;
    // contact.*는 LLM이 만들지 않고 컴파일러가 예시값을 넣는다(4.6.2). 그 밖에 덱에 없는 키는 범위 밖
    if (list === undefined) return (m?.[1] ?? "").startsWith("contact.");
    return Array.isArray(list) && Number(m?.[2]) < list.length;
  });
}

/** S2 카피: initial → repair_schema 1회 → fallback 모델 1회(잡 경과 ≤ 60s) → 템플릿 덱(4.7.1·S-12). refused면 null. */
async function copyDeck(
  x: Ctx,
  brand: Obj,
  purpose: DeckPurpose,
  maxChars: number,
): Promise<{ deck: Obj; source: "llm" | "template" } | "refused"> {
  // 4.6.2 maxChars_job: 프롬프트 변수(덱 hero.headline 3옵션 중 ≥ 1개가 이 값 이하)
  const input = { brand, purpose, maxCharsJob: maxChars };
  const schema = CopyDeckSchema(purpose);
  const tries: { callKind: CallKind; isFallback: boolean }[] = [
    { callKind: "initial", isFallback: false },
    { callKind: "repair_schema", isFallback: false },
    { callKind: "initial", isFallback: true },
  ];
  for (const t of tries) {
    const r = await callLlm(x, { role: "gen_copy", candidateIndex: null, input, ...t });
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
  o: { claimedBy?: string } = {},
): Promise<{ status: string }> {
  try {
    return await runJob(d, jobId, o);
  } catch (e) {
    process.stderr.write(`[generation] ${jobId} ${String((e as Error).stack ?? e)}\n`);
    await setJob(d.db, jobId, { error_message: String((e as Error).message ?? e).slice(0, 500) });
    await finishGenerationJob(d.db, jobId, {
      now: d.now?.() ?? new Date(),
      errorCode: "RENDER_ERROR",
    });
    return { status: "failed" };
  }
}

async function runJob(
  d: GenerationDeps,
  jobId: string,
  o: { claimedBy?: string },
): Promise<{ status: string }> {
  const now = (): string => (d.now?.() ?? new Date()).toISOString();
  const jr = await d.db.withService((tx) =>
    q(tx, "select * from generation_jobs where id = $1", [jobId]),
  );
  const job = jr.rows[0];
  if (!job) throw new Error(`job 없음 ${jobId}`);
  // queued(직접 실행) 또는 claimNext가 이 워커에 넘긴 running 잡만 실행
  const claimed =
    job.status === "running" && o.claimedBy !== undefined && job.worker_id === o.claimedBy;
  if (job.status !== "queued" && !claimed) return { status: String(job.status) };
  const pr = await d.db.withService((tx) =>
    q(tx, "select * from projects where id = $1", [job.project_id]),
  );
  const project = pr.rows[0] ?? {};
  const snapshot = (job.config_snapshot ?? {}) as Obj;
  const provider =
    d.provider ??
    createMockProvider({ scenario: (snapshot.mockScenario as string | undefined) ?? undefined });
  const jobCap = await d.db.withService((tx) => flagValue(tx, "JOB_COST_CAP_USD", JOB_CAP_DEFAULT));
  const slo = new AbortController();
  const sloTimer = setTimeout(
    () => slo.abort("slo"),
    thresholdNumber("generation.fallbackAtSec") * 1000,
  );
  sloTimer.unref();
  const x: Ctx = {
    d,
    job,
    project,
    provider,
    snapshot,
    budget: createJobBudget({ jobCapUsd: Number(jobCap) }),
    costCapped: false,
    overrunAlerted: false,
    slo: slo.signal,
  };
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
      industryTags: industryTags(brand, D.imageTagKeywords),
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

  // S2 레이아웃 6 + 스키마 수리
  const cands: Cand[] = [];
  const raws: (RawTree | null)[] = [];
  const layoutCall = async (
    i: number,
    c: Cand,
    callKind: CallKind,
    extra: Obj = {},
    firstState?: CacheState,
    onResponse?: (ok: boolean) => void,
  ): Promise<RawTree | null> => {
    const base = { spec: c.spec, purpose, brand, ...extra };
    for (const kind of [callKind, "repair_schema"] as const) {
      // 수리 호출은 확정 덱(범위·키)을 함께 준다
      const deckNow = kind === "repair_schema" ? await deckP : null;
      if (kind === "repair_schema" && !deckNow) return null;
      const r = await callLlm(x, {
        role: "gen_layout",
        callKind: kind,
        candidateIndex: i,
        candidateId: c.id,
        input: deckNow ? { ...base, deck: deckNow } : base,
        ...(kind === callKind && onResponse ? { onResponse } : {}),
        cacheState:
          kind === callKind && firstState
            ? firstState
            : i === 0 && callKind === "initial"
              ? "cache_write"
              : "cached",
      });
      if (r.kind !== "ok") return null;
      const p = LayoutTreeRawSchema.safeParse(parseJson(r.text));
      if (!p.success) continue;
      const deck = await deckP;
      if (!deck) return null;
      if (deckRefsOk(p.data, deck)) return p.data as unknown as RawTree;
    }
    return null;
  };
  for (let i = 0; i < VARIANTS.length * 2; i++) {
    const variant = VARIANTS[Math.floor(i / 2)] ?? "v_true";
    const spec = specs[variant];
    const id = await insertCandidate(x, { slot: i, variant, spec, origin: "llm", round: 0 });
    cands.push({ id, slot: i, variant, spec, valid: false, tree: null, html: "", cols: null });
  }
  // U-01 두 물결(6.9.4 ③, V-01): 후보 0이 t0에 출발하고, 후보 1~5는 t1 = min(후보 0 사건 t1, t0 + 3s)에 함께 출발한다.
  // 후보 0이 t1 전에 실패했으면 1~5의 추정 cacheState는 cache_write, 아니면(진행 중·완료) cached.
  // 예약은 출발 순서(후보 1 → 5)대로 동기 호출되므로 거부 집합이 결정론이다(AC-06-61).
  // S2 카피 ∥ 후보 0(U-01 t0 동시 출발). 레이아웃 첫 호출은 덱 참조만 쓰므로 카피를 기다리지 않는다.
  // 사건 t1 = 후보 0 응답(Mock·비스트리밍). 그 정산 → 후보 1~5 예약·출발을 다른 정산보다 먼저 대기열에 넣는다(6.9.4 ③).
  const c0 = cands[0] as Cand;
  const t0 = Date.now();
  let onT1: (ok: boolean) => void = () => undefined;
  const t1 = new Promise<boolean>((res) => {
    onT1 = res;
  });
  const p0 = layoutCall(0, c0, "initial", {}, undefined, (ok) => onT1(ok));
  const copyP = copyDeck(x, brand, purpose, maxCharsJob(specs, D));
  const deckP = copyP.then((cp) => (cp === "refused" ? null : cp.deck));
  // 후보 0이 응답 없이 끝나면(예약 거부·SLO) t1은 오지 않으므로 p0 종료도 실패로 본다
  void p0.then(() => onT1(false));
  let wave: ReturnType<typeof setTimeout> | undefined;
  const at1 = await Promise.race([
    t1,
    new Promise<"timeout">((ok) => {
      wave = setTimeout(() => ok("timeout"), WAVE2_DELAY_MS);
      wave.unref();
    }),
  ]);
  clearTimeout(wave);
  const failedEarly = at1 === false;
  // 후보 0이 t1 전에 실패했으면 1~5는 t0 + 3s에 그대로 출발한다
  const left = t0 + WAVE2_DELAY_MS - Date.now();
  if (failedEarly && left > 0) await new Promise((ok) => setTimeout(ok, left).unref());
  const rest = cands
    .slice(1)
    .map((c, k) => layoutCall(k + 1, c, "initial", {}, failedEarly ? "cache_write" : "cached"));
  raws.push(await p0, ...(await Promise.all(rest)));
  // S2 카피 결과(레이아웃 6이 모두 끝난 뒤 판정해 남은 호출이 잡 종료 뒤에 기록되지 않게 한다)
  const copy = await copyP;
  if (copy === "refused") {
    await setJob(d.db, jobId, { error_message: "content_policy: 공급자 안전 거부" });
    await finishGenerationJob(d.db, jobId, {
      now: d.now?.() ?? new Date(),
      errorCode: "BLOCKED_BRAND",
    });
    return { status: "failed" };
  }
  await setJob(d.db, jobId, {
    copy_deck: JSON.stringify(copy.deck),
    copy_source: copy.source,
    progress_pct: 30,
  });
  if (copy.source === "template")
    await d.db.withService((tx) =>
      q(
        tx,
        "update generation_jobs set warnings = array_append(warnings, 'COPY_FALLBACK') where id = $1 and not ('COPY_FALLBACK' = any(warnings))",
        [jobId],
      ),
    );

  // 4.8 다양성: 위반 후보만 재호출 1회(origin diversity, round 1). 재호출도 위반이면 eligible=false(DIVERSITY)
  const info = (i: number, r: RawTree | null): SeqInfo | null =>
    r
      ? {
          index: i,
          hero: r.sections.find((s) => s.block === "hero")?.variant ?? "",
          blocks: r.sections.map((s) => s.block),
        }
      : null;
  const heroAllowed = new Set(VARIANTS.flatMap((v) => specs[v].layout_constraints.hero_variants))
    .size;
  const divFail = new Set<number>();
  const first = diversityViolations(
    raws.map((r, i) => info(i, r)),
    heroAllowed,
  );
  for (const [i, violations] of [...first].sort((a, b) => a[0] - b[0])) {
    const old = cands[i];
    if (!old) continue;
    await x.d.db.withService((tx) =>
      q(tx, "update candidates set schema_valid = true where id = $1", [old.id]),
    );
    const id = await insertCandidate(x, {
      slot: i,
      variant: old.variant,
      spec: old.spec,
      origin: "diversity",
      round: 1,
    });
    const c: Cand = { ...old, id, valid: false, tree: null, html: "", cols: null };
    cands[i] = c;
    raws[i] = await layoutCall(i, c, "diversity", { violations, keep: ["footer"] });
    const again = diversityViolations(
      raws.map((r, k) => info(k, r)),
      heroAllowed,
    );
    if (again.has(i)) divFail.add(i);
  }
  for (const [i, c] of cands.entries()) {
    const raw = raws[i] ?? null;
    if (!raw) continue;
    await evaluate(x, c, raw, copy.deck, brand);
    if (divFail.has(i) && c.cols) {
      c.cols = {
        ...c.cols,
        eligible: false,
        rank_score: null,
        quality_report: { ...c.cols.quality_report, hide_reason: "DIVERSITY", visible: false },
      };
      await x.d.db.withService((tx) =>
        q(
          tx,
          "update candidates set eligible = false, rank_score = null, quality_report = $2 where id = $1",
          [c.id, JSON.stringify(c.cols?.quality_report)],
        ),
      );
    }
  }
  await setJob(d.db, jobId, { phase: "scoring", progress_pct: 70 });

  // 4.11.2 수정 루프: 후보당 최대 1회(round 1, origin repair), 잡당 repair_quality ≤ 3.
  // 대상 = 노출 불가 후보 중 수정 가능한 사유. 우선순위: eligible 0개 변형 → 1개 변형, 같은 순위는 H+TM 큰 순
  const REPAIRABLE_GATES = new Set([
    "G-01",
    "G-04",
    "G-05",
    "G-06",
    "G-08",
    "G-09",
    "G-10",
    "G-11",
  ]);
  const eligibleIn = (v: Variant): number =>
    cands.filter((c) => c.variant === v && c.cols?.eligible).length;
  const targets = cands
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => {
      const r = c.cols?.quality_report;
      if (!c.valid || !r || c.cols?.eligible || divFail.has(i)) return false;
      const gateFail = r.hard.filter((g) => g.status === "fail").map((g) => g.id);
      if (gateFail.some((g) => !REPAIRABLE_GATES.has(g))) return false;
      return true;
    })
    .sort(
      (a, b) =>
        eligibleIn(a.c.variant) - eligibleIn(b.c.variant) ||
        (b.c.cols?.harmony_score ?? 0) +
          (b.c.cols?.taste_score ?? 0) -
          ((a.c.cols?.harmony_score ?? 0) + (a.c.cols?.taste_score ?? 0)) ||
        a.i - b.i,
    )
    .slice(0, REPAIR.maxCallsPerJob);
  if (targets.length) await setJob(d.db, jobId, { phase: "repairing", repair_rounds: 1 });
  for (const { c: old, i } of targets) {
    const r = old.cols?.quality_report;
    if (!r) continue;
    const violations = [
      ...r.hard
        .filter((g) => g.status === "fail")
        .map((g) => ({
          rule: g.id,
          where: "sections[*]",
          message: JSON.stringify(g.measured).slice(0, 200),
          fix_hint: "",
        })),
      ...[...r.lint.error, ...r.lint.warn].map((rule) => ({
        rule,
        where: "sections[*]",
        message: rule,
        fix_hint: "",
      })),
    ];
    const id = await insertCandidate(x, {
      slot: i,
      variant: old.variant,
      spec: old.spec,
      origin: "repair",
      round: 1,
    });
    const c: Cand = { ...old, id, valid: false, tree: null, html: "", cols: null };
    const rr = await callLlm(x, {
      role: "gen_layout",
      callKind: "repair_quality",
      candidateIndex: i,
      candidateId: id,
      input: {
        spec: c.spec,
        purpose,
        brand,
        deck: copy.deck,
        violations,
        axis_gaps: [],
        keep: ["footer"],
      },
      cacheState: "cached",
    });
    const p = rr.kind === "ok" ? LayoutTreeRawSchema.safeParse(parseJson(rr.text)) : null;
    if (!p?.success) continue;
    await evaluate(x, c, p.data as unknown as RawTree, copy.deck, brand);
    // 수리 결과가 더 낫거나 노출 가능하면 그 후보로 바꾼다
    if (c.cols?.eligible || (c.cols?.rank_score ?? -1) > (old.cols?.rank_score ?? -1)) cands[i] = c;
  }

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
      await callLlm(x, {
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
  const cost = await d.db.withService((tx) =>
    q(
      tx,
      "select coalesce(sum(cost_usd), 0)::float8 as c, coalesce(sum(tokens_in),0)::int as i, coalesce(sum(tokens_out),0)::int as o from llm_calls where job_id = $1",
      [jobId],
    ),
  );
  await setJob(d.db, jobId, {
    n_real: nReal,
    n_fallback: nFallback,
    cost_usd: Number(cost.rows[0]?.c ?? 0),
    tokens_in: Number(cost.rows[0]?.i ?? 0),
    tokens_out: Number(cost.rows[0]?.o ?? 0),
  });
  // R-15 판정 + 환불(fallback·failed)은 finish 한 곳에서(6.3.4 finish_generation_job)
  const { status } = await finishGenerationJob(d.db, jobId, {
    now: d.now?.() ?? new Date(),
    errorCode: nReal + nFallback === 0 ? "NO_ELIGIBLE" : x.costCapped ? "COST_CAP" : null,
  });
  return { status };
}
