// 03장 3.3 mapL1toL2: AC-03-09(앵커 재현)·AC-03-10(허용 집합·결정성)·AC-03-11(단조성). 데이터는 seed:temp 산출물.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AXES,
  type L1,
  type MapData,
  type PresetLite,
  clampToAllowed,
  mapL1toL2,
  roundHalfToZero,
} from "./map.js";

const ROOT = join(import.meta.dirname, "../../..");
const items = <T>(rel: string): T[] =>
  (JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as { items: T[] }).items;
const data: MapData = {
  taxonomy: items("data/taxonomy/taxonomy.json"),
  mapping: items("data/taxonomy/mapping.json"),
  pairings: items("data/fonts/pairings.json"),
  palettes: items("data/taxonomy/palettes.json"),
};
const presets: PresetLite[] = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) =>
  items<PresetLite>(`data/taxonomy/presets/PS-T${n}.json`),
);
const clip = (x: number): number => Math.min(1, Math.max(0, x));

describe("mapL1toL2 (03장 3.3)", () => {
  it("roundHalfToZero·clampToAllowed", () => {
    expect([0.5, -0.5, 0.51, 1.5, -1.6].map(roundHalfToZero)).toEqual([0, -0, 1, 1, -2]);
    expect(clampToAllowed(["a", "b", "c", "d"], 3, ["a", "b"], 1)).toBe("b");
    expect(clampToAllowed(["a", "b", "c", "d"], 0, ["c", "d"], -1)).toBe("c");
  });

  it("AC-03-09: t = a_T이면 앵커 프리셋 L2와 18키 모두 같다(8/8)", () => {
    for (const p of presets) expect(mapL1toL2(p.l1, p, data), p.id).toEqual(p.l2);
  });

  it("AC-03-10: 8유형 × 5축 × ±0.10·±0.30 = 160 입력이 허용 집합 안이고 결정적", () => {
    let n = 0;
    for (const p of presets)
      for (let a = 0; a < 5; a++)
        for (const d of [-0.3, -0.1, 0.1, 0.3]) {
          const t = p.l1.map((v, i) => (i === a ? clip(v + d) : v)) as unknown as L1;
          const r = mapL1toL2(t, p, data);
          for (const [k, v] of Object.entries(r))
            expect(p.allowed[k], `${p.id} ${k}=${v}`).toContain(v);
          expect(mapL1toL2(t, p, data)).toEqual(r);
          n++;
        }
    expect(n).toBe(160);
  });

  it("AC-03-11: 한 축만 증가시킬 때 그 축이 구동하는 서수 키 인덱스가 감소하지 않는다", () => {
    const tax = new Map(data.taxonomy.map((k) => [k.id, k.values]));
    let bad = 0;
    for (const p of presets)
      AXES.forEach((axis, a) => {
        // headline_weight는 페어링 선택(범주형)에 따라 값 목록이 바뀌어 단조성 대상에서 뺀다(ASM-015)
        const keys = data.mapping.filter(
          (m) => m.kind === "ordinal" && m.axis === axis && m.id !== "type.headline_weight",
        );
        let prev: Record<string, number> | null = null;
        for (let g = 0; g <= 10; g++) {
          const t = p.l1.map((v, i) => (i === a ? g / 10 : v)) as unknown as L1;
          const r = mapL1toL2(t, p, data);
          const idx = Object.fromEntries(
            keys.map((m) => [m.id, (tax.get(m.id) ?? []).indexOf(r[m.id] ?? "")]),
          );
          if (prev) for (const m of keys) if ((idx[m.id] ?? 0) < (prev[m.id] ?? 0)) bad++;
          prev = idx;
        }
      });
    expect(bad).toBe(0);
  });
});
