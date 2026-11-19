// 04장 4.3 보정 1·2단계(+4단계 κ 구간). 순수 함수. 3단계 스냅은 snap.ts, 변형 거리 강제(4.4)는 compileSpecs.
import type { DesignData } from "./data.js";
import { AXIS_KEYS } from "./predict.js";
import type { AxisKey, CalibrationTrace, MovedAxis, Purpose, TasteResult, Vec5 } from "./types.js";

/** 04장 4.3 용도 표(`config/calibration.json` v1 기본값을 사양 상수로 둔다, ASM-028 ⑤). A1..A5 순서. */
export interface PurposeCalib {
  lo: readonly number[];
  hi: readonly number[];
  center: readonly number[];
  alpha: number;
  emphasis: readonly number[];
}
export const PURPOSE_CALIB: Record<Purpose, PurposeCalib> = {
  saas: {
    lo: [0.1, 0.0, 0.0, 0.2, 0.0],
    hi: [0.8, 0.8, 1.0, 0.8, 0.7],
    center: [0.4, 0.4, 0.5, 0.55, 0.35],
    alpha: 0.4,
    emphasis: [-0.3, 0, 0, 0.5, -0.2],
  },
  local_business: {
    lo: [0.1, 0.2, 0.0, 0.1, 0.0],
    hi: [0.9, 1.0, 1.0, 0.7, 0.6],
    center: [0.5, 0.7, 0.55, 0.4, 0.25],
    alpha: 0.3,
    emphasis: [0.3, 0.5, 0.2, 0, 0],
  },
  portfolio: {
    lo: [0.0, 0.0, 0.0, 0.0, 0.0],
    hi: [1.0, 1.0, 1.0, 0.85, 1.0],
    center: [0.55, 0.5, 0.45, 0.3, 0.3],
    alpha: 0.1,
    emphasis: [0.5, 0, 0, -0.5, 0],
  },
};

/** 4.3 4단계 κ 구간 표(사양 상수, 판정 임계값이 아님. 테스트 기준 구현 KAPPA_BANDS와 같은 형태, ASM-028 ⑦). */
export const KAPPA_BANDS: readonly {
  from: number;
  s: number;
  e: number;
  level: "low" | "mid" | "high";
}[] = [
  { from: 0.75, s: 1.0, e: 0.05, level: "low" },
  { from: 0.5, s: 0.8, e: 0, level: "mid" },
  { from: -Infinity, s: 0.6, e: 0, level: "high" },
];
export function kappaBand(kappa: number): { s: number; e: number; level: "low" | "mid" | "high" } {
  const b = KAPPA_BANDS.find((x) => kappa >= x.from) ?? KAPPA_BANDS[KAPPA_BANDS.length - 1]!;
  return { s: b.s, e: b.e, level: b.level };
}

/** 4.3 2단계 사양 상수: |v2 − μ| ≥ movedAxisMin 축은 moved_axes. 유형 범위 = 앵커 ± typeRangeHalf(3.4.7). */
export const CALIB_SPEC = { movedAxisMin: 0.2, typeRangeHalf: 0.2 } as const;

const clip = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));
const toVec = (a: readonly number[]): Vec5 => {
  const v = {} as Vec5;
  AXIS_KEYS.forEach((k, i) => (v[k] = a[i] ?? 0));
  return v;
};
const toArr = (v: Vec5): number[] => AXIS_KEYS.map((k) => v[k]);

/** 유형 앵커 a_T = 프리셋 l1(3.4.7 단일 원천). */
export function anchorOf(typeId: string, data: DesignData): number[] {
  const p = data.presets.find((x) => x.typeId === typeId);
  if (!p) throw new Error(`calibrate: 유형 없음 ${typeId}`);
  return [...p.l1];
}

/** 유형 범위 = 앵커 ± 0.20을 [0,1]로 자름(3.4.7). */
export function typeRange(anchor: readonly number[]): { lo: number[]; hi: number[] } {
  return {
    lo: anchor.map((a) => clip(a - CALIB_SPEC.typeRangeHalf)),
    hi: anchor.map((a) => clip(a + CALIB_SPEC.typeRangeHalf)),
  };
}

export interface CalibrateInput {
  taste: TasteResult;
  purpose: Purpose;
  alpha: number;
}

export function calibrate(input: CalibrateInput, data: DesignData): CalibrationTrace {
  const { taste, purpose, alpha } = input;
  const typeId = taste.anchor_override_type_id ?? taste.type_id;
  const a = anchorOf(typeId, data);
  const range = typeRange(a);
  const p = PURPOSE_CALIB[purpose];
  const band = kappaBand(taste.kappa);
  const mu = toArr(taste.mu);
  const sigma = toArr(taste.sigma);
  const ins = new Set<AxisKey>(taste.insensitive_axes);

  const g = AXIS_KEYS.map((_, i) => {
    const u = clip(((sigma[i] ?? 0) - 0.08) / 0.17);
    return band.s * (1 - 0.5 * u);
  });
  const v1 = AXIS_KEYS.map((k, i) => {
    const ai = a[i] ?? 0;
    const m = ins.has(k) ? (p.center[i] ?? 0) : (mu[i] ?? 0);
    const lo = (range.lo[i] ?? 0) - band.e;
    const hi = (range.hi[i] ?? 1) + band.e;
    return clip(ai + (g[i] ?? 0) * (m - ai), lo, hi);
  });
  const v2 = v1.map((x, i) =>
    clip((1 - alpha) * x + alpha * (p.center[i] ?? 0), p.lo[i] ?? 0, p.hi[i] ?? 1),
  );

  const moved: MovedAxis[] = [];
  AXIS_KEYS.forEach((axis, i) => {
    const from = mu[i] ?? 0;
    const to = v2[i] ?? 0;
    if (Math.abs(to - from) < CALIB_SPEC.movedAxisMin) return;
    // 이동의 더 큰 몫을 만든 단계를 사유로 적는다(1단계 = 유형, 2단계 = 용도, ASM-028 ④)
    const byType = Math.abs((v1[i] ?? 0) - from);
    const byPurpose = Math.abs(to - (v1[i] ?? 0));
    moved.push({ axis, from, to, reason: byPurpose > byType ? "purpose" : "type" });
  });

  return {
    mu: toVec(mu),
    sigma: toVec(sigma),
    kappa: taste.kappa,
    insensitive_axes: [...taste.insensitive_axes],
    anchor: toVec(a),
    type_range: { lo: toVec(range.lo), hi: toVec(range.hi) },
    g: toVec(g),
    v1: toVec(v1),
    alpha,
    v2: toVec(v2),
    distance_enforced: false,
    moved_axes: moved,
  };
}
