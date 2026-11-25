// 05장 5.5.4 원시 → L1 매핑. 순수 함수. 정규화기 본문 = 5.8.2 스키마(data/normalizers/<version>.json).

export const AXES = ["expression", "temperature", "shape", "density", "depth"] as const;
export type Axis = (typeof AXES)[number];

export interface Normalizer {
  version: string;
  features: Record<string, { transform: "identity" | "log1p"; q: number[] }>;
  mapping: Record<
    Axis,
    { weights: Record<string, number>; sign: Record<string, number>; b0: number; b1: number }
  >;
  reliable: Record<Axis, boolean>;
}

/** 5.5.3: 축 가중치 합의 50% 이상이 null이면 그 축은 null. */
export const NULL_WEIGHT_MAX = 0.5;

const transform = (t: string, v: number): number => (t === "log1p" ? Math.log1p(v) : v);

/** N_j(f): 101분위 선형 보간 경험적 분포함수. 범위 밖은 0·1, 같은 값이 여러 분위면 중간 순위(5.8.2). */
export function quantileRank(q: readonly number[], v: number): number {
  const n = q.length - 1;
  if (n <= 0) return 0.5;
  const lo = q[0]!;
  const hi = q[n]!;
  if (v < lo) return 0;
  if (v > hi) return 1;
  // 같은 값 구간
  let first = -1;
  let last = -1;
  for (let i = 0; i <= n; i++)
    if (q[i] === v) {
      if (first < 0) first = i;
      last = i;
    }
  if (first >= 0) return (first + last) / 2 / n;
  for (let i = 0; i < n; i++) {
    const a = q[i]!;
    const b = q[i + 1]!;
    if (v > a && v < b) return (i + (v - a) / (b - a)) / n;
  }
  return 1;
}

/** 5.5.4: Features(원시) → L1 5축(null 허용). */
export function toL1(
  features: Record<string, unknown>,
  nz: Normalizer,
): Record<Axis, number | null> {
  const out = {} as Record<Axis, number | null>;
  for (const k of AXES) {
    const m = nz.mapping[k];
    let wSum = 0;
    let wNull = 0;
    let s = 0;
    for (const [fid, w] of Object.entries(m.weights)) {
      wSum += w;
      const raw = features[fid];
      const def = nz.features[fid];
      if (typeof raw !== "number" || !def) {
        wNull += w;
        continue;
      }
      const N = quantileRank(def.q, transform(def.transform, raw));
      s += w * ((m.sign[fid] ?? 1) < 0 ? 1 - N : N);
    }
    if (wSum === 0 || wNull / wSum >= NULL_WEIGHT_MAX) {
      out[k] = null;
      continue;
    }
    const sk = s / (wSum - wNull); // null 특징 가중치 제외 후 재정규화
    out[k] = Math.min(1, Math.max(0, m.b0 + m.b1 * sk));
  }
  return out;
}
