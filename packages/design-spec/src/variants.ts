// 04장 4.4 변형 3종 목표 벡터와 최소 거리 강제. 순수·결정적. 해석은 ASSUMPTIONS ASM-033.
import { thresholdNumber } from "@tastefit/config";
import { CALIB_SPEC, PURPOSE_CALIB, calibrate } from "./calibrate.js";
import type { DesignData } from "./data.js";
import { AXIS_KEYS } from "./predict.js";
import type { CalibrationTrace, MovedAxis, Purpose, TasteResult, Variant, Vec5 } from "./types.js";

/** 4.4 사양 상수: α_FIT = min(fitAlphaMax, α_p + fitAlphaAdd), ê 폴백 경계. */
export const VARIANT_SPEC = { fitAlphaMax: 0.8, fitAlphaAdd: 0.4, unitDirMin: 0.1 } as const;

const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const clip = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const toArr = (v: Vec5): number[] => AXIS_KEYS.map((k) => v[k]);
const toVec = (a: readonly number[]): Vec5 => {
  const v = {} as Vec5;
  AXIS_KEYS.forEach((k, i) => (v[k] = a[i] ?? 0));
  return v;
};
/** D(x, y) = 5축 L1 합. */
export const l1Dist = (x: readonly number[], y: readonly number[]): number =>
  x.reduce((s, v, i) => s + Math.abs(v - (y[i] ?? 0)), 0);

export interface VariantTarget {
  target: Vec5;
  trace: CalibrationTrace;
}

function movedAxes(mu: number[], v1: number[], to: number[], viaDistance: boolean[]): MovedAxis[] {
  const out: MovedAxis[] = [];
  AXIS_KEYS.forEach((axis, i) => {
    const from = mu[i] ?? 0;
    const t = to[i] ?? 0;
    if (Math.abs(t - from) < CALIB_SPEC.movedAxisMin) return;
    const byType = Math.abs((v1[i] ?? 0) - from);
    const byPurpose = Math.abs(t - (v1[i] ?? 0));
    const reason = viaDistance[i] ? "distance" : byPurpose > byType ? "purpose" : "type";
    out.push({ axis, from, to: t, reason });
  });
  return out;
}

/** 4.4: t_TRUE(α=0)·t_FIT(α_FIT)·t_BAL(중점), D(t_TRUE, t_FIT) ≥ targetDistTf 강제. */
export function variantTargets(
  taste: TasteResult,
  purpose: Purpose,
  data: DesignData,
): Record<Variant, VariantTarget> {
  const p = PURPOSE_CALIB[purpose];
  const dMin = thresholdNumber("generation.variant.targetDistTf");
  const alphaFit = Math.min(VARIANT_SPEC.fitAlphaMax, p.alpha + VARIANT_SPEC.fitAlphaAdd);
  const trT = calibrate({ taste, purpose, alpha: 0 }, data);
  const trF = calibrate({ taste, purpose, alpha: alphaFit }, data);
  const tT = toArr(trT.v2);
  const fit0 = toArr(trF.v2);
  const clipP = (a: number[]): number[] =>
    a.map((x, i) => clip(x, p.lo[i] ?? 0, p.hi[i] ?? 1));

  let tF = fit0;
  let enforced = false;
  const d0 = l1Dist(tT, fit0);
  if (d0 < dMin) {
    enforced = true;
    const e =
      d0 >= VARIANT_SPEC.unitDirMin
        ? fit0.map((x, i) => (x - (tT[i] ?? 0)) / d0)
        : [...p.emphasis];
    const fwd = clipP(fit0.map((x, i) => x + (dMin - d0) * (e[i] ?? 0)));
    tF = fwd;
    if (l1Dist(tT, fwd) < dMin) {
      const back = clipP(tT.map((x, i) => x - dMin * (e[i] ?? 0)));
      // 두 시도 모두 미달이면 거리가 더 큰 쪽(같으면 정방향)을 쓴다(ASM-033 ③)
      if (l1Dist(tT, back) > l1Dist(tT, fwd)) tF = back;
    }
  }
  const tB = tT.map((x, i) => (x + (tF[i] ?? 0)) / 2);

  const mu = toArr(trT.mu);
  const changed = tF.map((x, i) => Math.abs(x - (fit0[i] ?? 0)) > 1e-12);
  const none = AXIS_KEYS.map(() => false);
  const v1T = toArr(trT.v1);
  const v1F = toArr(trF.v1);
  const tTr = tT.map(r3);
  const tFr = tF.map(r3);
  const tBr = tB.map(r3);
  return {
    v_true: {
      target: toVec(tTr),
      trace: { ...trT, distance_enforced: enforced, moved_axes: movedAxes(mu, v1T, tTr, none) },
    },
    v_fit: {
      target: toVec(tFr),
      trace: {
        ...trF,
        distance_enforced: enforced,
        moved_axes: movedAxes(mu, v1F, tFr, changed),
      },
    },
    v_bal: {
      target: toVec(tBr),
      trace: {
        ...trF,
        alpha: r3(alphaFit / 2),
        v2: toVec(tB),
        distance_enforced: enforced,
        moved_axes: movedAxes(mu, v1F, tBr, changed),
      },
    },
  };
}
