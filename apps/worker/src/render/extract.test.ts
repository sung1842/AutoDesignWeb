import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadDesignData, standardTree } from "@tastefit/design-spec";
import { compilePage } from "@tastefit/renderer";
import type { Features } from "@tastefit/extractor";
import { openHarness, type Harness } from "./harness.js";

const data = loadDesignData(new URL("../../../..", import.meta.url).pathname);
let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PIXEL = ["F14", "F15", "F19", "F20", "F21"] as const;
// 5.5.3 키 30개(F01~F30)가 모두 있어야 한다. 측정 불가는 null(0 대체 금지).
const KEYS = Array.from({ length: 30 }, (_, i) => `F${String(i + 1).padStart(2, "0")}`);

describe("추출기 원시 특징 F01~F30(M2-09d1, 05장 5.5, ASM-066)", () => {
  it("프리셋 앵커 8종 1280: 키 30개, tf- 서체 분류, 다크·pill 판정, 2회 추출 결정성(5.5.6)", async () => {
    const all: Record<string, Features> = {};
    for (const t of TYPES) {
      const { spec, tree } = standardTree(t, "saas", data);
      const { html } = compilePage(spec, tree, data);
      const a = await h.features(html, 1280);
      const b = await h.features(html, 1280);
      for (const k of KEYS) expect(k in a, `${t} ${k}`).toBe(true);
      expect(a.area_h).toBe(2400);
      expect(a.F26.heading_class, t).not.toBe("unknown");
      expect(a.F26.body_class, t).not.toBe("unknown");
      expect(a.F26.body_family, t).toMatch(/^tf-/);
      // DOM 특징 완전 일치, 픽셀 특징 차이 ≤ 0.01
      const dom = (f: Features): unknown => {
        const o: Record<string, unknown> = { ...f };
        for (const k of PIXEL) delete o[k];
        return o;
      };
      expect(dom(b), t).toEqual(dom(a));
      for (const k of PIXEL)
        expect(Math.abs((a[k] ?? 0) - (b[k] ?? 0)), `${t} ${k}`).toBeLessThanOrEqual(0.01);
      all[t] = a;
    }
    expect(
      Object.entries(all)
        .filter(([, f]) => f.F25)
        .map(([t]) => t),
    ).toEqual(["T7"]);
    expect(all.T6!.F02).toBe(1); // pill 버튼(3.4.7 shape 최상위)
    expect(all.T2!.F01).toBe(0); // sharp
    expect(all.T4!.F14!).toBeGreaterThan(all.T7!.F14!); // 따뜻한 T4 > 차가운 T7
  });
});
