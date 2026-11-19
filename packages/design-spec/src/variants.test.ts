// 04장 4.4 변형 목표 벡터·최소 거리 강제 단위 테스트(ASM-033).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PURPOSE_CALIB } from "./calibrate.js";
import { loadDesignData } from "./data.js";
import { AXIS_KEYS } from "./predict.js";
import type { Purpose, TasteResult, Vec5 } from "./types.js";
import { l1Dist, variantTargets } from "./variants.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const PURPOSES: Purpose[] = ["saas", "local_business", "portfolio"];
const vec = (a: number[]): Vec5 => Object.fromEntries(AXIS_KEYS.map((k, i) => [k, a[i]])) as Vec5;
const arr = (v: Vec5): number[] => AXIS_KEYS.map((k) => v[k]);
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("variantTargets 4.4", () => {
  it("1,000회: 범위·3자리, D(T,F) ≥ 0.50이거나 distance_enforced, 그 외 쌍 ≥ 0.25(반올림 허용 0.005)", () => {
    const r = rng(44);
    const bad: string[] = [];
    let enforced = 0;
    for (let i = 0; i < 1000; i++) {
      const purpose = PURPOSES[i % 3]!;
      const taste: TasteResult = {
        mu: vec(AXIS_KEYS.map(() => r())),
        sigma: vec(AXIS_KEYS.map(() => 0.05 + 0.25 * r())),
        kappa: r(),
        insensitive_axes: [],
        type_id: TYPES[Math.floor(r() * 8)]!,
      };
      const v = variantTargets(taste, purpose, data);
      const p = PURPOSE_CALIB[purpose];
      for (const k of ["v_true", "v_fit", "v_bal"] as const)
        arr(v[k].target).forEach((x, j) => {
          if (x < p.lo[j]! || x > p.hi[j]!) bad.push(`${i} ${k} 범위 ${x}`);
          if (Math.round(x * 1000) / 1000 !== x) bad.push(`${i} ${k} 3자리 ${x}`);
        });
      const [t, f, b] = [v.v_true.target, v.v_fit.target, v.v_bal.target].map(arr) as [
        number[],
        number[],
        number[],
      ];
      const d = l1Dist(t, f);
      if (v.v_fit.trace.distance_enforced) enforced++;
      if (d < 0.5 - 0.005) {
        if (!v.v_fit.trace.distance_enforced) bad.push(`${i} D ${d} 강제 기록 없음`);
      } else {
        if (l1Dist(t, b) < 0.25 - 0.01 || l1Dist(f, b) < 0.25 - 0.01) bad.push(`${i} BAL 거리`);
      }
      for (const m of v.v_fit.trace.moved_axes)
        expect(["type", "purpose", "distance"]).toContain(m.reason);
    }
    expect(bad).toEqual([]);
    expect(enforced).toBeGreaterThan(0);
  });

  it("α: v_true 0, v_fit min(0.8, α_p + 0.4), v_bal 중간", () => {
    const taste: TasteResult = {
      mu: vec([0.5, 0.5, 0.5, 0.5, 0.5]),
      sigma: vec([0.1, 0.1, 0.1, 0.1, 0.1]),
      kappa: 0.8,
      insensitive_axes: [],
      type_id: "T1",
    };
    const exp: Record<Purpose, number> = { saas: 0.8, local_business: 0.7, portfolio: 0.5 };
    for (const p of PURPOSES) {
      const v = variantTargets(taste, p, data);
      expect(v.v_true.trace.alpha).toBe(0);
      expect(v.v_fit.trace.alpha).toBeCloseTo(exp[p], 9);
      expect(v.v_bal.trace.alpha).toBeCloseTo(exp[p] / 2, 3);
    }
  });
});
