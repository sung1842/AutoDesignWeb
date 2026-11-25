import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { iconStrokeFor, iconSvg, PATHS } from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const map = (
  JSON.parse(readFileSync(join(ROOT, "data/icons/map.json"), "utf8")) as { items: { id: string }[] }
).items;

describe("아이콘 인라인 SVG(3.9, ASM-049)", () => {
  it("map.json 의미 40개 전부 도형이 있고 남는 도형이 없다", () => {
    expect(Object.keys(PATHS).sort()).toEqual(map.map((m) => m.id).sort());
  });
  it("세트 3 × 40 = 120: svg·세트·굵기 속성, aria-hidden, 스크립트·이벤트·링크·색 리터럴 없음", () => {
    for (const set of ["phosphor", "tabler", "iconoir"] as const)
      for (const m of map) {
        const svg = iconSvg(set, m.id, { strokeWidth: 2 });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain(`data-icon-set="${set}"`);
        expect(svg).toContain('data-icon-stroke="2"');
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toContain('stroke="currentColor"');
        expect(svg).not.toMatch(/<script|\son[a-z]+=|href=|#[0-9a-f]{3,6}\b/i);
      }
  });
  it("굵기는 radius family 연동(4.9.3)", () => {
    expect(["sharp", "soft", "round", "pill"].map(iconStrokeFor)).toEqual([1.5, 1.5, 2, 2]);
  });
  it("모르는 의미는 예외", () => {
    expect(() => iconSvg("tabler", "nope", { strokeWidth: 1.5 })).toThrow();
  });
});
