// 02장 2.16 시뮬레이터(실제 엔진 호출, ASM-091). 모집단·응답 모델·변형·지표·합격선 판정·부트스트랩.
import { getThresholds } from "@tastefit/config";
import { createEngine, type EngineItems } from "./engine.js";
import {
  diagConst,
  mulberry32,
  nearestType,
  priorPosterior,
  tuned as loadTuned,
  updateMNL,
  type Tuned,
  type TypeCenter,
  type Vec,
} from "./model.js";

export type Population = "P-U" | "P-C" | "P-A";
export type Variant =
  "none" | "V-NONE" | "V-RAND" | "V-PRIOR" | "V-MEAS" | "V-LAMBDA" | "V-POS" | "V-MIX";
export interface Condition {
  id: string;
  population: Population;
  beta: number;
  variant: Variant;
}
export interface SimMetrics {
  n: number;
  rmse: number;
  top1: number;
  top2: number;
  coverage: number;
  kappaMean: number;
  maxQuestions: number;
  stage1Exact: boolean;
  errors: number;
  /** V-PRIOR: 용도 사전 vs 중립 사전 재생 유형 변경률(용도별 최대). */
  priorTypeChange?: number;
  /** 사용자별 값(부트스트랩용): 축 제곱오차 합, top-1 적중. */
  perUser: { se: number; hit: number }[];
  /** 문항 수 대비 RMSE(1~16). */
  curve: number[];
}

/** 2.16.1 모집단·변형 상수(사양 표 원문). */
export const SIM_SPEC = {
  puRange: [0.1, 0.9] as [number, number],
  pcNoiseSd: 0.1,
  pcClip: [0.02, 0.98] as [number, number],
  noneRate: 0.1,
  lambdaMul: [1.5, 1, 1, 0.7, 0.7],
  posBonus: 0.1,
  mixBetas: [16, 8, 4, 2],
  z90: 1.645,
  bootstrap: 200,
  syntheticCardNoise: 0.05,
  syntheticAbNoise: 0.03,
} as const;
const PURPOSES = ["saas", "portfolio", "local_business"] as const;
const AXES = 5;

/** 정규 난수(Box-Muller). */
function normal(r: () => number): number {
  const u = Math.max(Number.MIN_VALUE, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const clip = (x: number, [lo, hi]: [number, number]): number => Math.min(hi, Math.max(lo, x));

function thetaFor(
  pop: Population,
  i: number,
  n: number,
  types: readonly TypeCenter[],
  r: () => number,
): Vec {
  if (pop === "P-U")
    return Array.from(
      { length: AXES },
      () => SIM_SPEC.puRange[0] + (SIM_SPEC.puRange[1] - SIM_SPEC.puRange[0]) * r(),
    );
  if (pop === "P-A")
    return [...(types[Math.floor((i * types.length) / n) % types.length]?.centroid ?? [])];
  const m = types[Math.floor(r() * types.length)]?.centroid ?? [];
  return m.map((c) => clip(c + SIM_SPEC.pcNoiseSd * normal(r), SIM_SPEC.pcClip));
}

/** 응답 모델: 이상점 MNL(β_true, 축 λ, 위치 가산). 반환 = 선택 인덱스. */
function respond(
  xs: Vec[],
  theta: Vec,
  beta: number,
  lam: readonly number[],
  posBonus: number,
  r: () => number,
): number {
  const u = xs.map(
    (x) => -beta * x.reduce((s, v, k) => s + (lam[k] ?? 1) * (v - (theta[k] ?? 0)) ** 2, 0),
  );
  const m = Math.max(...u);
  let p = u.map((x) => Math.exp(x - m));
  const t = p.reduce((s, x) => s + x, 0);
  p = p.map((x) => x / t);
  if (posBonus > 0) {
    p[0] = (p[0] ?? 0) + posBonus;
    const t2 = p.reduce((s, x) => s + x, 0);
    p = p.map((x) => x / t2);
  }
  let x = r();
  for (let i = 0; i < p.length; i++) {
    x -= p[i] ?? 0;
    if (x <= 0) return i;
  }
  return p.length - 1;
}

export interface SimInput {
  items: EngineItems;
  /** V-MEAS 지각용 계획 L1(itemId → target_l1). */
  perceived?: Map<string, Vec>;
  types: readonly TypeCenter[];
  condition: Condition;
  n: number;
  seed: number;
  tuned?: Tuned;
}

/** 조건 1개 × 시드 1개. 같은 seed면 θ*·응답 난수열이 같다(공통 난수 쌍체, V-RAND 비교). */
export function simulate(input: SimInput): SimMetrics {
  const D = diagConst();
  const tu = input.tuned ?? loadTuned();
  const { condition: c, types } = input;
  const popR = mulberry32(input.seed);
  const out: SimMetrics = {
    n: input.n,
    rmse: 0,
    top1: 0,
    top2: 0,
    coverage: 0,
    kappaMean: 0,
    maxQuestions: 0,
    stage1Exact: true,
    errors: 0,
    perUser: [],
    curve: Array.from({ length: D.maxQuestions }, () => 0),
  };
  const curveN = Array.from({ length: D.maxQuestions }, () => 0);
  let cover = 0;
  let kappa = 0;
  const changes = new Map<string, number>();
  const sig0 = Array.from({ length: AXES }, () => D.sigma0);
  for (let i = 0; i < input.n; i++) {
    const theta = thetaFor(c.population, i, input.n, types, popR);
    const respR = mulberry32((input.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    const beta =
      c.variant === "V-MIX" ? (SIM_SPEC.mixBetas[i % SIM_SPEC.mixBetas.length] ?? c.beta) : c.beta;
    const lam = c.variant === "V-LAMBDA" ? SIM_SPEC.lambdaMul : D.lambda;
    const purpose = c.variant === "V-PRIOR" ? (PURPOSES[i % PURPOSES.length] ?? null) : null;
    try {
      const e = createEngine({
        items: input.items,
        types,
        seed: `sim-${input.seed}-${i}`,
        purpose,
        tuned: tu,
        policy: c.variant === "V-RAND" ? "random" : "adaptive",
      });
      let asked = 0;
      let s1 = 0;
      for (let q = e.next(); q; q = e.next()) {
        asked++;
        if (q.stage === 1) s1++;
        const xs = q.options.map((o) =>
          c.variant === "V-MEAS" ? (input.perceived?.get(o.itemId) ?? o.x) : o.x,
        );
        const pick = respond(
          xs,
          theta,
          beta,
          lam,
          c.variant === "V-POS" && q.stage === 1 ? SIM_SPEC.posBonus : 0,
          respR,
        );
        const noneRoll = respR();
        if (c.variant === "V-NONE" && q.kind !== "check" && noneRoll < SIM_SPEC.noneRate)
          e.answer({
            seq: q.seq,
            kind: q.stage === 1 ? "none_of_these" : "cant_tell",
            latencyMs: 3000,
          });
        else
          e.answer({
            seq: q.seq,
            kind: "option",
            chosen: q.options[pick]?.itemId,
            latencyMs: 3000,
          });
        const mu = e.state().mu;
        const se = mu.reduce((s, m, k) => s + (m - (theta[k] ?? 0)) ** 2, 0);
        out.curve[asked - 1] = (out.curve[asked - 1] ?? 0) + se / AXES;
        curveN[asked - 1] = (curveN[asked - 1] ?? 0) + 1;
      }
      out.maxQuestions = Math.max(out.maxQuestions, asked);
      if (s1 !== D.stage1Questions) out.stage1Exact = false;
      const r = e.result();
      const truth = nearestType(theta, sig0, types).typeId;
      const se = r.mu.reduce((s, m, k) => s + (m - (theta[k] ?? 0)) ** 2, 0);
      const hit = r.typeId === truth ? 1 : 0;
      out.perUser.push({ se, hit });
      out.top1 += hit;
      out.top2 += r.typeId === truth || r.secondTypeId === truth ? 1 : 0;
      kappa += r.kappa;
      r.axes.forEach((a, k) => {
        const lo = a.mu - SIM_SPEC.z90 * a.sigmaDisplay;
        const hi = a.mu + SIM_SPEC.z90 * a.sigmaDisplay;
        if ((theta[k] ?? 0) >= lo && (theta[k] ?? 0) <= hi) cover++;
      });
      if (purpose) {
        // 같은 로그를 중립 사전으로 재생
        let post = priorPosterior(null, tu);
        for (const row of e.log())
          if (row.a.kind === "option" && row.q.kind !== "check")
            post = updateMNL(
              post,
              row.q.options.map((o) => o.x),
              row.q.options.findIndex((o) => o.itemId === row.a.chosen),
              D.beta,
              D.lambda,
            );
        const neutral = nearestType(post.mu, post.var.map(Math.sqrt), types).typeId;
        const key = `${purpose}:n`;
        changes.set(key, (changes.get(key) ?? 0) + 1);
        if (neutral !== r.typeId) changes.set(purpose, (changes.get(purpose) ?? 0) + 1);
      }
    } catch {
      out.errors++;
    }
  }
  const n = Math.max(1, out.perUser.length);
  out.rmse = Math.sqrt(out.perUser.reduce((s, u) => s + u.se, 0) / (n * AXES));
  out.top1 /= n;
  out.top2 /= n;
  out.coverage = cover / (n * AXES);
  out.kappaMean = kappa / n;
  out.curve = out.curve.map((v, i) => ((curveN[i] ?? 0) > 0 ? Math.sqrt(v / (curveN[i] ?? 1)) : 0));
  if (c.variant === "V-PRIOR")
    out.priorTypeChange = Math.max(
      ...PURPOSES.map((p) => (changes.get(p) ?? 0) / Math.max(1, changes.get(`${p}:n`) ?? 0)),
    );
  return out;
}

/** 여러 시드 풀링(점추정). */
export function pooled(runs: SimMetrics[]): SimMetrics {
  const perUser = runs.flatMap((r) => r.perUser);
  const n = Math.max(1, perUser.length);
  const w = (f: (r: SimMetrics) => number): number =>
    runs.reduce((s, r) => s + f(r) * r.perUser.length, 0) / n;
  const prior = runs.map((r) => r.priorTypeChange).filter((x): x is number => x !== undefined);
  return {
    n,
    rmse: Math.sqrt(perUser.reduce((s, u) => s + u.se, 0) / (n * AXES)),
    top1: w((r) => r.top1),
    top2: w((r) => r.top2),
    coverage: w((r) => r.coverage),
    kappaMean: w((r) => r.kappaMean),
    maxQuestions: Math.max(...runs.map((r) => r.maxQuestions)),
    stage1Exact: runs.every((r) => r.stage1Exact),
    errors: runs.reduce((s, r) => s + r.errors, 0),
    ...(prior.length ? { priorTypeChange: Math.max(...prior) } : {}),
    perUser,
    curve: runs[0]?.curve.map((_, i) => w((r) => r.curve[i] ?? 0)) ?? [],
  };
}

/** 2.16.1 조건 목록(차단 판정 조건 + 비차단 변형). */
export const CONDITIONS: Condition[] = [
  { id: "PU-b16", population: "P-U", beta: 16, variant: "none" },
  { id: "PU-b8", population: "P-U", beta: 8, variant: "none" },
  { id: "PU-b4", population: "P-U", beta: 4, variant: "none" },
  { id: "PU-b2", population: "P-U", beta: 2, variant: "none" },
  { id: "PC-b8", population: "P-C", beta: 8, variant: "none" },
  { id: "PC-b4", population: "P-C", beta: 4, variant: "none" },
  { id: "PA-b8", population: "P-A", beta: 8, variant: "none" },
  { id: "PU-b8-rand", population: "P-U", beta: 8, variant: "V-RAND" },
  { id: "PU-b8-prior", population: "P-U", beta: 8, variant: "V-PRIOR" },
  { id: "PU-b8-none", population: "P-U", beta: 8, variant: "V-NONE" },
  { id: "PU-b8-meas", population: "P-U", beta: 8, variant: "V-MEAS" },
  { id: "PU-b8-lambda", population: "P-U", beta: 8, variant: "V-LAMBDA" },
  { id: "PU-b8-pos", population: "P-U", beta: 8, variant: "V-POS" },
  { id: "PU-b8-mix", population: "P-U", beta: 8, variant: "V-MIX" },
];
/** 비차단 변형(2.16.2 마지막 행). */
export const NON_BLOCKING: readonly Variant[] = ["V-MEAS", "V-LAMBDA", "V-POS", "V-MIX"];

export interface Check {
  key: string;
  value: number;
  limit: number | [number, number];
  kind: "max" | "min" | "range";
  pass: boolean;
  ci?: [number, number];
  marginWarning?: boolean;
}
interface SimLimits {
  rmseBeta8Max: number;
  rmseBeta4Max: number;
  typeAccPCBeta8Min: number;
  typeAccPCBeta4Min: number;
  top1PUMin: number;
  top2PUMin: number;
  coverage90: [number, number];
  adaptiveRmseGainMin: number;
  adaptiveTop1GainMinPp: number;
  consistencyBeta16Min: number;
  consistencyBeta2Max: number;
  anchorAccPABeta8Min: number;
  priorTypeChangeMax: number;
  robustNoneRmseMax: number;
}
export const limits = (): SimLimits =>
  (getThresholds().release as unknown as { surveySim: SimLimits }).surveySim;
/** 백분율 점(pp) 환산. */
const PP = 100;

function bootstrap(
  xs: { se: number; hit: number }[],
  f: (s: { se: number; hit: number }[]) => number,
  seed: number,
): [number, number] {
  const r = mulberry32(seed);
  const vals: number[] = [];
  for (let b = 0; b < SIM_SPEC.bootstrap; b++) {
    const s = Array.from(
      { length: xs.length },
      () => xs[Math.floor(r() * xs.length)] as { se: number; hit: number },
    );
    vals.push(f(s));
  }
  vals.sort((a, c) => a - c);
  const at = (q: number): number =>
    vals[Math.min(vals.length - 1, Math.floor(q * vals.length))] ?? 0;
  return [at(0.025), at(0.975)];
}
const rmseOf = (s: { se: number }[]): number =>
  Math.sqrt(s.reduce((a, u) => a + u.se, 0) / (Math.max(1, s.length) * AXES));
const top1Of = (s: { hit: number }[]): number =>
  s.reduce((a, u) => a + u.hit, 0) / Math.max(1, s.length);

/** 2.16.2 합격선 판정. results = 조건 id → 풀링 지표. */
export function judge(results: Record<string, SimMetrics>, seed = 1): Check[] {
  const L = limits();
  const D = diagConst();
  const g = (id: string): SimMetrics => {
    const m = results[id];
    if (!m) throw new Error(`sim: 조건 결과 없음 ${id}`);
    return m;
  };
  const mk = (
    key: string,
    value: number,
    limit: Check["limit"],
    kind: Check["kind"],
    ci?: [number, number],
  ): Check => {
    const pass =
      kind === "max"
        ? value <= (limit as number)
        : kind === "min"
          ? value >= (limit as number)
          : value >= (limit as [number, number])[0] && value <= (limit as [number, number])[1];
    const lim = typeof limit === "number" ? limit : null;
    const marginWarning = ci !== undefined && lim !== null && ci[0] <= lim && ci[1] >= lim;
    return { key, value, limit, kind, pass, ...(ci ? { ci, marginWarning } : {}) };
  };
  const pu8 = g("PU-b8");
  const rand = g("PU-b8-rand");
  const pairs = pu8.perUser.map((u, i) => ({ a: u, b: rand.perUser[i] ?? u }));
  const gainRmse = (rand.rmse - pu8.rmse) / Math.max(Number.EPSILON, rand.rmse);
  const gainTop1 = (pu8.top1 - rand.top1) * PP;
  const r = mulberry32(seed);
  const gainCi = ((): [number, number] => {
    const vals: number[] = [];
    for (let b = 0; b < SIM_SPEC.bootstrap; b++) {
      const s = Array.from(
        { length: pairs.length },
        () => pairs[Math.floor(r() * pairs.length)] as (typeof pairs)[number],
      );
      const ra = rmseOf(s.map((x) => x.a));
      const rb = rmseOf(s.map((x) => x.b));
      vals.push((rb - ra) / Math.max(Number.EPSILON, rb));
    }
    vals.sort((a, c) => a - c);
    return [
      vals[Math.floor(0.025 * vals.length)] ?? 0,
      vals[Math.min(vals.length - 1, Math.floor(0.975 * vals.length))] ?? 0,
    ];
  })();
  const all = Object.values(results);
  return [
    mk("rmseBeta8Max", pu8.rmse, L.rmseBeta8Max, "max", bootstrap(pu8.perUser, rmseOf, seed)),
    mk("rmseBeta4Max", g("PU-b4").rmse, L.rmseBeta4Max, "max"),
    mk(
      "typeAccPCBeta8Min",
      g("PC-b8").top1,
      L.typeAccPCBeta8Min,
      "min",
      bootstrap(g("PC-b8").perUser, top1Of, seed + 1),
    ),
    mk("typeAccPCBeta4Min", g("PC-b4").top1, L.typeAccPCBeta4Min, "min"),
    mk("top1PUMin", pu8.top1, L.top1PUMin, "min"),
    mk("top2PUMin", pu8.top2, L.top2PUMin, "min"),
    mk(
      "anchorAccPABeta8Min",
      g("PA-b8").top1,
      L.anchorAccPABeta8Min,
      "min",
      bootstrap(g("PA-b8").perUser, top1Of, seed + 2),
    ),
    mk("coverage90", pu8.coverage, L.coverage90, "range"),
    mk("consistencyBeta16Min", g("PU-b16").kappaMean, L.consistencyBeta16Min, "min"),
    mk("consistencyBeta2Max", g("PU-b2").kappaMean, L.consistencyBeta2Max, "max"),
    mk("adaptiveRmseGainMin", gainRmse, L.adaptiveRmseGainMin, "min", gainCi),
    mk("adaptiveTop1GainMinPp", gainTop1, L.adaptiveTop1GainMinPp, "min"),
    mk("priorTypeChangeMax", g("PU-b8-prior").priorTypeChange ?? 0, L.priorTypeChangeMax, "max"),
    mk("robustNoneRmseMax", g("PU-b8-none").rmse, L.robustNoneRmseMax, "max"),
    mk(
      "diagnosis.maxQuestions",
      Math.max(...all.map((m) => m.maxQuestions)),
      D.maxQuestions,
      "max",
    ),
    mk("diagnosis.stage1Questions", all.every((m) => m.stage1Exact) ? 1 : 0, 1, "min"),
    mk(
      "errors",
      all.reduce((s, m) => s + m.errors, 0),
      0,
      "max",
    ),
  ];
}
