import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  expectedSize,
  fitHeadline,
  headlineBudget,
  headlineFits,
  loadDesignData,
  standardTree,
} from "./index.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));

describe("3.8.1 헤드라인 줄 예산(ASM-064)", () => {
  it("headlineBudget: textWidth 식(1280 = min(container,1200)·lg/12 − 24, 375 = 343·base/4)", () => {
    const b1 = headlineBudget(48, 1280, { lg: 6, base: 4 }, 1200);
    expect(b1.perLine).toBe(Math.floor(Math.floor((1200 * 6) / 12 - 24) / (48 * 0.95)));
    expect(b1.maxChars).toBe(Math.floor(b1.perLine * 2 * 0.85));
    const b2 = headlineBudget(32, 375, { lg: 6, base: 4 }, 1200);
    expect(b2.maxChars).toBe(Math.floor(Math.floor(343 / (32 * 0.95)) * 3 * 0.85));
  });
  it("2자 헤드라인은 고아로 보고 다른 옵션으로 바꾸며, 못 맞추면 한 단 내린다", () => {
    const { spec } = standardTree("T5", "saas", data);
    const cols = { lg: 10, base: 4 };
    expect(headlineFits("한결", "t-1", spec.tokens, cols, 1200, expectedSize)).toBe(false);
    const r = fitHeadline(
      ["한결", "일정과 할 일을 한 화면에서"],
      0,
      "t-display",
      spec.tokens,
      cols,
      1200,
      expectedSize,
    );
    expect(r.index).toBe(1);
    expect(r.warn).toBe(false);
  });
  it("표준 트리의 하향은 role_overrides.headline에만 기록된다", () => {
    for (const t of ["T5", "T8"]) {
      const { tree } = standardTree(t, "portfolio", data);
      const ro = tree.sections.find((s) => s.id === "hero")?.role_overrides;
      if (ro) expect(Object.keys(ro)).toEqual(["headline"]);
    }
  });
});
