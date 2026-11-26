// 단계 T 단위 테스트(ASM-073): 표준 트리 24개 위반 0, 규칙별 변조 1건씩 검출.
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadDesignData, standardTree } from "@tastefit/design-spec";
import { treeLintImpl } from "./stage-t.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const data = loadDesignData(ROOT);
type Sec = {
  id: string;
  block: string;
  variant: string;
  bg: string;
  pad: number;
  slots: Record<string, unknown>;
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const rules = (spec: unknown, tree: unknown): string[] =>
  treeLintImpl(spec, tree).map((f) => f.rule);

describe("treeLint 단계 T", () => {
  it("표준 트리 8유형 × 3용도 위반 0", () => {
    for (const t of ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"])
      for (const p of ["saas", "local_business", "portfolio"]) {
        const { spec, tree } = standardTree(t, p, data);
        expect(treeLintImpl(spec, tree), `${t}/${p}`).toEqual([]);
      }
  });
  it("변조 검출: G-01·LT-01·03·04·05·06·07·09", () => {
    const { spec, tree } = standardTree("T1", "saas", data);
    const secs = (x: unknown): Sec[] => (x as { sections: Sec[] }).sections;
    let t = clone(tree);
    (t as Record<string, unknown>).extra = 1;
    expect(rules(spec, t)).toEqual(["G-01"]);
    t = clone(tree);
    secs(t).splice(
      secs(t).findIndex((s) => s.block === "cta"),
      1,
    );
    expect(rules(spec, t)).toContain("LT-03");
    t = clone(tree);
    secs(t).reverse();
    expect(rules(spec, t)).toContain("LT-04");
    t = clone(tree);
    secs(t).push({ ...clone(secs(t).at(-1)!), id: "cta2" });
    expect(rules(spec, t)).toEqual(expect.arrayContaining(["LT-05", "LT-09"]));
    t = clone(tree);
    for (const s of secs(t)) s.pad = 0;
    expect(rules(spec, t)).toContain("LT-07");
    t = clone(tree);
    for (const s of secs(t)) if (s.bg === "inverse") s.bg = "bg";
    expect(rules(spec, t)).toContain("LT-06");
    const lc = clone(spec.layout_constraints);
    lc.required_blocks = [...lc.required_blocks, "stats"];
    expect(rules({ ...spec, layout_constraints: lc }, tree)).toContain("LT-01");
  });
});
