import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { fallbackMockup, loadDesignData, standardTree } from "@tastefit/design-spec";
import { PageSchema } from "@tastefit/layout-schema";
import { compilePage } from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const PURPOSES = ["saas", "local_business", "portfolio"];
const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
const issues = (t: unknown): string[] => {
  const r = PageSchema.safeParse(t);
  return r.success
    ? []
    : r.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("standardTree·fallbackMockup(M2-08, ASM-053)", () => {
  it("8유형 × 3용도 표준 트리: PageSchema 유효, 표준 패턴, 컴파일 결정적", () => {
    const bad: string[] = [];
    for (const t of TYPES)
      for (const p of PURPOSES) {
        const { spec, tree } = standardTree(t, p, data);
        for (const e of issues(tree)) bad.push(`${t}/${p} ${e}`);
        expect((tree as unknown as { pattern_id: string }).pattern_id).toBe(
          { saas: "PS-1", local_business: "PL-1", portfolio: "PP-1" }[p],
        );
        const a = compilePage(spec, tree, data).html;
        expect(compilePage(spec, tree, data).html).toBe(a);
      }
    expect(bad).toEqual([]);
  });
  it("72 폴백: 변형 명세 그대로, PageSchema 유효", () => {
    const bad: string[] = [];
    for (const t of TYPES)
      for (const p of PURPOSES)
        for (const v of VARIANTS) {
          const { spec, tree } = fallbackMockup(t, p, v, data);
          expect(spec.variant).toBe(v);
          for (const e of issues(tree)) bad.push(`${t}/${p}/${v} ${e}`);
        }
    expect(bad).toEqual([]);
  });
  it("옵션: 페어링 덮어쓰기는 l2·토큰에 반영, 브랜드명은 워드마크", () => {
    const pr = data.pairingsFull[3]!;
    const { spec, tree } = standardTree("T1", "saas", data, {
      pairingId: pr.code,
      brandName: "테스트",
    });
    expect(spec.l2["type.pairing_id"]).toBe(pr.code);
    expect(JSON.stringify(tree)).toContain('"text":"테스트"');
  });
});
