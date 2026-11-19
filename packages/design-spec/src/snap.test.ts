// 03장 3.3 용도 경로 + 04장 4.3 3단계 snapToFeasible 단위 테스트(ASM-029).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { L1 } from "@tastefit/taxonomy";
import { loadDesignData } from "./data.js";
import { AXIS_KEYS } from "./predict.js";
import {
  P_ORDER,
  inFeasible,
  l2Conflicts,
  mapL1toL2ForPurpose,
  presetOfType,
  snapToFeasible,
} from "./snap.js";
import type { Purpose, Vec5 } from "./types.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const PURPOSES: Purpose[] = ["saas", "local_business", "portfolio"];
const vec = (a: readonly number[]): Vec5 => {
  const v = {} as Vec5;
  AXIS_KEYS.forEach((k, i) => (v[k] = a[i] ?? 0));
  return v;
};
const SIG = vec([0.08, 0.08, 0.08, 0.08, 0.08]);

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

describe("snapToFeasible", () => {
  it("P_ORDER는 icon.set을 뺀 17키", () => {
    expect(P_ORDER).toHaveLength(17);
    expect(P_ORDER).not.toContain("icon.set");
  });

  it("앵커 프리셋 L2는 purpose=null에서 F에 속하고 상충 0", () => {
    for (const t of TYPES) {
      const p = presetOfType(t, data);
      expect(l2Conflicts(p.l2, { typeId: t, purpose: null }, data), t).toEqual([]);
      expect(inFeasible(p.l2, { typeId: t, purpose: null }, data), t).toBe(true);
    }
  });

  it("t = 앵커이면 결과 = 앵커 프리셋(용도 금지값만 대체)", () => {
    for (const t of TYPES)
      for (const purpose of PURPOSES) {
        const p = presetOfType(t, data);
        const ctx = { typeId: t, purpose };
        const l2 = mapL1toL2ForPurpose(p.l1, t, purpose, data);
        const out = snapToFeasible(l2, vec(p.l1), SIG, ctx, data);
        const exp = { ...p.l2 };
        if (purpose === "local_business" && exp["media.mode"] === "type-led")
          exp["media.mode"] = "photo-led";
        expect(out, `${t}/${purpose}`).toEqual(exp);
      }
  });

  it("무작위 목표 240건: 결과는 항상 F에 속하고 결정적", () => {
    const r = rng(43);
    for (let n = 0; n < 240; n += 1) {
      const typeId = TYPES[n % TYPES.length]!;
      const purpose = PURPOSES[n % PURPOSES.length]!;
      const t = AXIS_KEYS.map(() => Math.round(r() * 1000) / 1000);
      const sigma = vec(AXIS_KEYS.map(() => 0.05 + r() * 0.25));
      const ctx = { typeId, purpose };
      const l2 = mapL1toL2ForPurpose(t as unknown as L1, typeId, purpose, data);
      const out = snapToFeasible(l2, vec(t), sigma, ctx, data);
      expect(inFeasible(out, ctx, data), `${typeId}/${purpose} ${t.join(",")}`).toBe(true);
      expect(snapToFeasible(l2, vec(t), sigma, ctx, data)).toEqual(out);
    }
  });
});
