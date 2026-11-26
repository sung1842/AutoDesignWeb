// 02장 2.5 갱신 모델·2.6.1 문항 점수·2.12 유형 판정·2.8.1 사전(ASM-090). 순수 함수, float64.
// 상수 원천: config/thresholds.json diagnosis, config/diagnosis-tuned.json(값을 코드에 쓰지 않는다, AC-02-30).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, getThresholds } from "@tastefit/config";
import { PURPOSE_CALIB } from "@tastefit/design-spec";

export type Vec = number[];
export interface Posterior {
  mu: Vec;
  var: Vec;
}
export interface TypeCenter {
  id: string;
  centroid: Vec;
}
export interface DiagConst {
  beta: number;
  sigma0: number;
  sigmaStop: number;
  maxQuestions: number;
  stage1Questions: number;
  lambda: Vec;
  stage1: {
    minPairDist: number;
    minDistinctTypes: number;
    maxAppearPerVector: number;
    epsilonExplore: number;
  };
  noneAvoidDist: number;
  noneExploreAfter: number;
  cantTellInsensitiveAfter: number;
  consistency: { checkBonus: number; minScored: number };
  typing: {
    tieEps: number;
    boundaryEps: number;
    conflictMinPicks: number;
    conflictMinCenterDist: number;
    lowSignalMinPicks: number;
  };
  positionBias: { sameSlotRatio: number; minAnswers: number };
  fastAnswerMs: number;
}
export interface Tuned {
  typeDiscWeight: number;
  llChance: number;
  llRef: number;
  calibKappa: number;
  candidateSamples: number;
  priorWeight: number;
  bridgeRelocated: boolean;
}
let C: DiagConst | null = null;
let T: Tuned | null = null;
export function diagConst(): DiagConst {
  return (C ??= getThresholds().diagnosis as unknown as DiagConst);
}
export function tuned(root: string = findRepoRoot()): Tuned {
  return (T ??= JSON.parse(
    readFileSync(join(root, "config/diagnosis-tuned.json"), "utf8"),
  ) as Tuned);
}

/** 반올림 자릿수(2.5.2·2.12.1 "소수 6자리"). */
export const ROUND = { decimals: 6, scale: 1e6 } as const;
export const r6 = (x: number): number => Math.round(x * ROUND.scale) / ROUND.scale;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** 2.8.1 μ0 = (1 − w)·0.5 + w·c_p, 용도 없으면 0.5. 중심 c_p 원천 = 04장 4.3 용도 표(design-spec PURPOSE_CALIB). */
export const NEUTRAL = 0.5;
export function priorMu(purpose: string | null, tu: Tuned = tuned()): Vec {
  const c = purpose ? PURPOSE_CALIB[purpose as keyof typeof PURPOSE_CALIB] : undefined;
  if (!c) return [NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL];
  const w = tu.priorWeight;
  return c.center.map((ck) => (1 - w) * NEUTRAL + w * ck);
}
export function priorPosterior(purpose: string | null, tu: Tuned = tuned()): Posterior {
  const s0 = diagConst().sigma0;
  const mu = priorMu(purpose, tu);
  return { mu, var: mu.map(() => s0 * s0) };
}

/** 선택지 효용 계수(2.5.1): z_i = 2λx_i, b_i = −Σλx². */
function zb(X: Vec[], lam: Vec): { z: Vec[]; b: Vec } {
  return {
    z: X.map((x) => x.map((v, k) => 2 * (lam[k] ?? 1) * v)),
    b: X.map((x) => -x.reduce((s, v, k) => s + (lam[k] ?? 1) * v * v, 0)),
  };
}
/** β=8 다항 로짓 확률 P(i | θ, S)(최댓값을 빼고 계산). */
export function choiceProbs(X: Vec[], theta: Vec, beta: number, lam: Vec): Vec {
  const { z, b } = zb(X, lam);
  const u = z.map(
    (zi, i) => beta * (zi.reduce((s, zz, k) => s + zz * (theta[k] ?? 0), 0) + (b[i] ?? 0)),
  );
  const m = Math.max(...u);
  const e = u.map((x) => Math.exp(x - m));
  const t = e.reduce((s, x) => s + x, 0);
  return e.map((x) => x / t);
}
/** Fisher 정보 대각 H_kk(S; μ)(2.5.2). */
export function fisherDiag(X: Vec[], mu: Vec, beta: number, lam: Vec): Vec {
  const { z } = zb(X, lam);
  const p = choiceProbs(X, mu, beta, lam);
  return mu.map((_, k) => {
    const zbar = p.reduce((s, pj, j) => s + pj * (z[j]?.[k] ?? 0), 0);
    const ez2 = p.reduce((s, pj, j) => s + pj * (z[j]?.[k] ?? 0) ** 2, 0);
    return beta * beta * (ez2 - zbar * zbar);
  });
}

/** 2.5.3 updateMNL. */
export function updateMNL(
  post: Posterior,
  X: Vec[],
  chosen: number,
  beta: number,
  lam: Vec,
): Posterior {
  const { z } = zb(X, lam);
  const p = choiceProbs(X, post.mu, beta, lam);
  const mu = [...post.mu];
  const v = [...post.var];
  for (const k of post.mu.keys()) {
    const zbar = p.reduce((s, pj, j) => s + pj * (z[j]?.[k] ?? 0), 0);
    const ez2 = p.reduce((s, pj, j) => s + pj * (z[j]?.[k] ?? 0) ** 2, 0);
    const H = beta * beta * (ez2 - zbar * zbar);
    const g = beta * ((z[chosen]?.[k] ?? 0) - zbar);
    v[k] = 1 / (1 / (post.var[k] ?? 1) + H);
    mu[k] = clamp01((post.mu[k] ?? 0) + (v[k] ?? 0) * g);
  }
  return { mu, var: v };
}

export interface TypeJudge {
  typeId: string;
  secondTypeId: string;
  order: string[];
  margin: number;
  isTie: boolean;
  isBoundary: boolean;
}
/** 2.12.1 판정 함수(결정론). sigma = 축별 표준편차(정밀도 가중 타이브레이크). */
export function nearestType(mu: Vec, sigma: Vec, types: readonly TypeCenter[]): TypeJudge {
  const D = diagConst();
  const rows = types.map((t, idx) => ({
    id: t.id,
    idx,
    d: r6(Math.sqrt(t.centroid.reduce((s, c, k) => s + ((mu[k] ?? 0) - c) ** 2, 0))),
    dp: Math.sqrt(
      t.centroid.reduce(
        (s, c, k) => s + ((mu[k] ?? 0) - c) ** 2 / Math.max(Number.EPSILON, (sigma[k] ?? 1) ** 2),
        0,
      ),
    ),
  }));
  rows.sort((a, b) => a.d - b.d || a.idx - b.idx);
  const [a, b] = [rows[0], rows[1]];
  if (!a || !b) throw new Error("nearestType: 유형 2개 이상 필요");
  const margin = r6(b.d - a.d);
  const isTie = margin < D.typing.tieEps;
  if (isTie && (b.dp < a.dp - TIE.dpEps || (Math.abs(b.dp - a.dp) < TIE.dpEps && b.idx < a.idx))) {
    rows[0] = b;
    rows[1] = a;
  }
  return {
    typeId: rows[0]?.id ?? "",
    secondTypeId: rows[1]?.id ?? "",
    order: rows.map((r) => r.id),
    margin,
    isTie,
    isBoundary: margin < D.typing.boundaryEps,
  };
}
/** 2.12.1 ② |d'| 차 비교 허용 오차. */
const TIE = { dpEps: 1e-6 } as const;

/** 2.6.1 1단계 점수 = Σ log(1/σ² + H) + w_type·Σ|P(i|c_m1) − P(i|c_m2)|. */
export function stage1Score(
  post: Posterior,
  X: Vec[],
  types: readonly TypeCenter[],
  tu: Tuned = tuned(),
): number {
  const D = diagConst();
  const H = fisherDiag(X, post.mu, D.beta, D.lambda);
  const dopt = H.reduce((s, h, k) => s + Math.log(1 / (post.var[k] ?? 1) + h), 0);
  const nt = nearestType(post.mu, post.var.map(Math.sqrt), types);
  const c1 = types.find((t) => t.id === nt.typeId)?.centroid ?? post.mu;
  const c2 = types.find((t) => t.id === nt.secondTypeId)?.centroid ?? post.mu;
  const p1 = choiceProbs(X, c1, D.beta, D.lambda);
  const p2 = choiceProbs(X, c2, D.beta, D.lambda);
  return dopt + tu.typeDiscWeight * p1.reduce((s, x, i) => s + Math.abs(x - (p2[i] ?? 0)), 0);
}

/** 2.13.1 S03 안내 선택(서버가 고른다). */
export type Notice = "low_signal" | "conflict" | "low_consistency" | "boundary";
/** 04장 4.3 4단계 보조 강도 구간(κ < 0.50 = 높음 → 재진단 권유). */
export const KAPPA_SPEC = { low: 0.5, high: 0.75, lowCap: 0.49, midCap: 0.74 } as const;
export function pickNotice(p: {
  flags: readonly string[];
  kappa: number;
  isBoundary: boolean;
}): Notice | null {
  if (p.flags.includes("low_signal")) return "low_signal";
  if (p.flags.includes("conflict")) return "conflict";
  if (p.kappa < KAPPA_SPEC.low) return "low_consistency";
  if (p.isBoundary) return "boundary";
  return null;
}

/** mulberry32(hash32(seed, seq, attempt))(2.6). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngFor = (seed: string, seq: number, attempt = 0): (() => number) =>
  mulberry32(hash32(`${seed}|${seq}|${attempt}`));
