import { describe, expect, it } from "vitest";
import { COLOR_NAMES, colorName } from "./color-name.js";

describe("colorName(3.13.5, ASM-062)", () => {
  it("사전 ≥ 40, 기본 색 구간이 0~360을 빈틈없이 덮는다", () => {
    expect(COLOR_NAMES.length).toBeGreaterThanOrEqual(40);
    const base = COLOR_NAMES.filter((e) => !e.l && !e.c);
    for (let d = 0; d < 360; d += 0.5)
      expect(
        base.some((e) =>
          e.h[0] <= e.h[1] ? d >= e.h[0] && d < e.h[1] : d >= e.h[0] || d < e.h[1],
        ),
        String(d),
      ).toBe(true);
  });
  it("무채색·대표 색·수식어·결정성", () => {
    expect(colorName("#000000")).toBe("검정");
    expect(colorName("#FFFFFF")).toBe("흰색");
    expect(colorName("#808080")).toBe("회색");
    expect(colorName("#1E2A78")).toMatch(/남색|네이비|파랑|코발트/);
    expect(colorName("#FFD400")).toMatch(/노랑|레몬색|겨자색|호박색/);
    expect(colorName("#2E8B57")).toMatch(/초록|풀색/);
    expect(colorName("#6B3E26")).toMatch(/갈색|짙은/);
    expect(colorName("#C2987A")).toBe(colorName("#C2987A"));
  });
});
