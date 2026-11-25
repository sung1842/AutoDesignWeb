import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { PageSchema } from "@tastefit/layout-schema";
import { compilePage, GENERATOR_COMMENT, type PTree } from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const p = data.presets[0]!;
const spec = {
  spec_id: "0123456789abcdef",
  variant: "v_true",
  type_id: p.typeId,
  purpose: "saas",
  theme: "light" as const,
  l2: p.l2 as Record<string, unknown>,
  tokens: deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet,
};
const T = (text: string, placeholder = false) => ({ text, placeholder, deck_ref: "deck:hero.headline#0" });
const tree: PTree = {
  schemaVersion: "1",
  spec_id: "0123456789abcdef",
  pattern_id: "PS-1",
  nav: { variant: "nav.split", items: [{ label: "기능", target: "#features" }] },
  sections: [
    {
      id: "hero",
      block: "hero",
      variant: "hero.type-only",
      bg: "bg",
      pad: 0,
      slots: {
        headline: { copy: T(`<script>alert(1)</script>`) },
        sub: { copy: T("설명 \"따옴표\" & 기호") },
        primaryCta: { link: { label: T("시작하기"), target: "#features" } },
      },
    },
    {
      id: "features",
      block: "value",
      variant: "value.numbered",
      bg: "surface",
      pad: 0,
      slots: { items: { list: [{ copy: { ...T("빠름"), sub: "설명" } }] } },
    },
  ],
  footer: {
    variant: "footer.minimal",
    slots: { wordmark: { copy: T("한결") }, businessInfo: { copy: T("상호 한결", true) } },
  },
};

describe("compilePage 골격(CM-04~06·14·16)", () => {
  it("결정적·이스케이프·시맨틱·속성", () => {
    const a = compilePage(spec, tree, data).html;
    expect(compilePage(spec, tree, data).html).toBe(a);
    expect(a).not.toMatch(/<script/i);
    expect(a).toContain("&lt;script&gt;");
    expect(a.indexOf(GENERATOR_COMMENT)).toBe(a.indexOf("<head>") + 6);
    expect(a).toContain('<meta name="generator" content="TasteFit (AI-generated design draft)">');
    expect(a.match(/<h1[ >]/g)).toHaveLength(1);
    expect(a.match(/class="tf-skip-link"/g)).toHaveLength(1);
    expect(a).toContain('data-section-id="features"');
    expect(a).toContain('aria-labelledby="features-h"');
    expect(a).toContain('data-slot-id="features.items.0"');
    expect(a).toContain('data-placeholder="true"');
    expect(a).toMatch(/<header[^>]*><nav/);
    expect(a).toContain(":root {");
    expect(a).not.toMatch(/\sstyle=/);
    expect(a).toContain("왜 선택해야 할까요");
  });
  it("앵커 밖 링크는 href를 내지 않는다", () => {
    const bad = structuredClone(tree);
    bad.nav.items[0]!.target = "javascript:alert(1)";
    expect(compilePage(spec, bad, data).html).not.toContain("javascript:");
  });
  it("PageSchema 형식과 맞는다(테스트 트리 자체 검사)", () => {
    const r = PageSchema.safeParse(tree);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });
});
