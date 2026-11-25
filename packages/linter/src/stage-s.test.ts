// 04장 4.13 단계 S 단위 테스트(ASM-038).
import { describe, expect, it } from "vitest";
import { staticLint } from "./m2.js";

const dim = (v: number) => ({ $type: "dimension", $value: { value: v, unit: "px" } });
const layer = (blur: number, alpha: number) => ({
  color: { colorSpace: "oklch", components: [0.2, 0.01, 70], alpha, hex: "#000000" },
  offsetX: { value: 0, unit: "px" },
  offsetY: { value: 4, unit: "px" },
  blur: { value: blur, unit: "px" },
  spread: { value: 0, unit: "px" },
});
const fam = (f: string) => ({ $type: "fontFamily", $value: [f, "sans-serif"] });
function spec(over: Record<string, unknown> = {}, tok: Record<string, unknown> = {}) {
  return {
    type_id: "T2",
    l2: { "depth.style": "subtle-shadow", "depth.shadow_level": "2", "media.treatment": "none" },
    tokens: {
      font: { heading: fam("tf-kr-gowun-batang"), body: fam("tf-kr-gowun-dodum") },
      radius: { md: dim(4) },
      shadow: { "level-2": { $type: "shadow", $value: [layer(8, 0.1)] } },
      ...tok,
    },
    signature: { id: "SIG-01", intensity: 1, apply_to: ["value"] },
    decor: { effects: [], max: 1 },
    forbidden: { lint_rules_strict: [], conflict_ids: [] },
    ...over,
  };
}
const rules = (x: unknown) => staticLint(x).map((f) => `${f.rule}:${f.severity}`);

describe("staticLint 단계 S", () => {
  it("정상 명세는 0건", () => expect(rules(spec())).toEqual([]));
  it("AIL-03: 같은 기본 서체 1종이면 error", () => {
    const reg = "tf-kr-pretendard"; // 레지스트리 별칭 → "Pretendard"로 풀어 비교
    expect(rules(spec({}, { font: { heading: fam(reg), body: fam(reg) } }))).toEqual([
      "AIL-03:error",
    ]);
    expect(rules(spec({}, { font: { heading: fam("Inter"), body: fam("Inter") } }))).toEqual([
      "AIL-03:error",
    ]);
    expect(rules(spec({}, { font: { heading: fam("Geist"), body: fam("Noto Serif") } }))).toEqual([
      "AIL-03:error",
    ]);
  });
  it("AIL-06: radius 12–16 + blur ≥ 16 ∧ α ≤ 0.15 → error, T3·T4·T6은 warn", () => {
    const soft = {
      radius: { md: dim(12) },
      shadow: { "level-2": { $type: "shadow", $value: [layer(32, 0.08)] } },
    };
    expect(rules(spec({}, soft))).toEqual(["AIL-06:error"]);
    expect(rules(spec({ type_id: "T4" }, soft))).toEqual(["AIL-06:warn"]);
    expect(rules(spec({ l2: { "depth.style": "flat", "depth.shadow_level": "2" } }, soft))).toEqual(
      [],
    );
  });
  it("AIL-01: 보라+파랑 고채도 그라디언트 토큰", () => {
    const st = (h: number) => ({ color: { components: [0.6, 0.2, h] }, position: 0 });
    const g = { grad: { $type: "gradient", $value: [st(290), st(230)] } };
    expect(rules(spec({}, g))).toEqual(["AIL-01:error"]);
  });
  it("명세 정합: 장식 예산·상충·예약 그림자·duotone·glass·SIG-05", () => {
    expect(rules(spec({ decor: { effects: ["grain", "glass"], max: 1 } }))).toContain(
      "SPEC-DECOR:error",
    );
    expect(rules(spec({ decor: { effects: ["glass"], max: 1 } }))).toContain("AIL-09:error");
    expect(rules(spec({ forbidden: { lint_rules_strict: [], conflict_ids: ["CF-05"] } }))).toEqual([
      "SPEC-CF:error",
    ]);
    expect(rules(spec({ l2: { "depth.style": "flat", "depth.shadow_level": "3" } }))).toEqual([
      "SPEC-RESERVED:error",
    ]);
    expect(rules(spec({ l2: { "depth.style": "flat", "media.treatment": "duotone" } }))).toEqual([
      "SPEC-DUOTONE:error",
    ]);
    expect(rules(spec({ signature: { id: "SIG-05" } }))).toEqual(["SPEC-SIG:error"]);
    expect(rules(null)).toEqual(["SPEC-SHAPE:error"]);
  });
});
