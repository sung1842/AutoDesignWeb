import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, fnv64, fontPlan, subsetChars, SUBSET_BASE, type PTree } from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const T = (text: string) => ({ text, placeholder: false, deck_ref: "deck:x#0" });
const tree: PTree = {
  schemaVersion: "1",
  spec_id: "0123456789abcdef",
  pattern_id: "PS-1",
  nav: { variant: "nav.split", items: [] },
  sections: [
    {
      id: "s0",
      block: "story",
      variant: "story.text",
      bg: "bg",
      pad: 0,
      slots: { body: { copy: T("뷁 테스트") } },
    },
  ],
  footer: { variant: "footer.minimal", slots: { wordmark: { copy: T("한결") } } },
};
const specFor = (i: number) => {
  const p = data.presets[i]!;
  return {
    spec_id: "0123456789abcdef",
    variant: "v_true",
    type_id: p.typeId,
    purpose: "saas",
    theme: "light" as const,
    l2: p.l2 as Record<string, unknown>,
    tokens: deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet,
  };
};

describe("폰트 계획(3.7.4·3.7.5·CM-09, ASM-050)", () => {
  it("서브셋 글자 = 기본(ASCII 95 + 문장부호) ∪ 본문, 정렬·중복 없음, 해시 결정적", () => {
    const c = subsetChars("가나가");
    expect(c.includes("가") && c.includes("나")).toBe(true);
    expect(new Set(c).size).toBe([...c].length);
    for (const ch of SUBSET_BASE) expect(c).toContain(ch);
    expect(fnv64(c)).toBe(fnv64(subsetChars("나가")));
    expect(fnv64(c)).not.toBe(fnv64(subsetChars("다")));
  });
  it("모든 페어링: 파일 ≤ 5, preload = heading + body 400(≤ 2), 경로는 상대·woff2", () => {
    for (const pr of data.pairingsFull) {
      const plan = fontPlan({
        pairingId: pr.code,
        headingWeight: 700,
        emphasisWeight: 600,
        pairings: data.pairingsFull,
        fonts: data.fonts,
        text: "본문",
      });
      expect(plan.faces.length, pr.code).toBeGreaterThanOrEqual(2);
      expect(plan.faces.length, pr.code).toBeLessThanOrEqual(5);
      expect(plan.faces.filter((f) => f.preload).map((f) => f.role)).toEqual(
        ["heading", "body"].slice(0, plan.faces.filter((f) => f.preload).length),
      );
      for (const f of plan.faces)
        expect(f.file).toMatch(/^assets\/fonts\/[a-z0-9-]+-\d{3}-[0-9a-f]{12}\.woff2$/);
    }
  });
  it("컴파일 HTML: @font-face(subsetFamily)·폴백 면·preload, 외부 URL 0, 같은 입력 같은 파일 이름", () => {
    for (let i = 0; i < data.presets.length; i++) {
      const r = compilePage(specFor(i), tree, data);
      expect(r.fonts.chars).toContain("뷁");
      for (const f of r.fonts.faces)
        expect(r.html).toContain(`font-family: "${f.family}"; src: url("${f.file}")`);
      expect(r.html).toContain('font-family: "tf-fb-sans"');
      expect(r.html.match(/rel="preload"/g)?.length ?? 0).toBeLessThanOrEqual(2);
      expect(r.html).not.toMatch(/url\("?(https?:)?\/\//);
      expect(compilePage(specFor(i), tree, data).fonts.hash).toBe(r.fonts.hash);
    }
  });
});
