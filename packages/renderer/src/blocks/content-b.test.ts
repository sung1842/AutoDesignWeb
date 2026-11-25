import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations, type PTree } from "../index.js";
import { CONTENT_B_CSS } from "../css/blocks/content-b.js";
import { CONTENT_B_TEMPLATES, MENU_PRICE_PLACEHOLDER } from "./content-b.js";

const ROOT = join(import.meta.dirname, "../../../..");
const data = loadDesignData(ROOT);
const BLOCKS = ["proof", "pricing", "faq", "cta", "menu"];
const p = data.presets[0]!;
const spec = {
  spec_id: "0123456789abcdef",
  variant: "v_true",
  type_id: p.typeId,
  purpose: "local_business",
  theme: "light" as const,
  l2: p.l2 as Record<string, unknown>,
  tokens: deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet,
};
const T = (text: string, sub?: string) => ({
  text,
  placeholder: false,
  deck_ref: "deck:x#0",
  ...(sub !== undefined ? { sub } : {}),
});
const list = { list: [0, 1, 2].map((i) => ({ copy: T(`항목${i}`, `김○○${i}`) })) };
const variants = data.blocks
  .filter((b) => BLOCKS.includes(b.id as string))
  .flatMap((b) =>
    (b.variants as { id: string }[]).map((v) => ({ block: b.id as string, id: v.id })),
  );
const slotsFor = (block: string): Record<string, unknown> =>
  block === "cta"
    ? {
        headline: { copy: T("지금 시작") },
        primaryCta: { link: { label: T("시작"), target: "#main" } },
      }
    : { [block === "pricing" ? "plans" : block === "menu" ? "groups" : "items"]: list };
const tree = (): PTree =>
  ({
    schemaVersion: "1",
    spec_id: spec.spec_id,
    pattern_id: "PS-1",
    nav: { variant: "nav.split", items: [] },
    sections: variants.map((v, i) => ({
      id: `s${i}`,
      block: v.block,
      variant: v.id,
      bg: "bg",
      pad: 0,
      slots: slotsFor(v.block),
    })),
    footer: { variant: "footer.minimal", slots: { wordmark: { copy: T("한결") } } },
  }) as PTree;
const sec = (html: string, i: number): string => {
  const a = html.indexOf(`<section id="s${i}"`);
  return html.slice(a, html.indexOf("</section>", a));
};

describe("proof·pricing·faq·cta·menu 템플릿(M2-06b2b, ASM-046)", () => {
  it("5블록 variant 전부에 템플릿이 있다", () => {
    expect(Object.keys(CONTENT_B_TEMPLATES).sort()).toEqual(variants.map((v) => v.id).sort());
  });
  it("variant별 핵심 구조·역할", () => {
    const html = compilePage(spec, tree(), data).html;
    variants.forEach((v, i) => {
      const s = sec(html, i);
      expect(s.match(/<h2 /g), v.id).toHaveLength(1);
      if (v.block === "proof") expect(s, v.id).toMatch(/<blockquote[^>]*data-role="quote"/);
      if (v.id === "proof.cards")
        expect(s).toContain('data-role="avatar.initials" aria-hidden="true">김<');
      if (v.block === "pricing") expect(s, v.id).toContain('data-role="pricing.price"');
      if (v.block === "faq") expect(s.match(/<details /g), v.id).toHaveLength(3);
      if (v.block === "cta") {
        expect(s, v.id).toContain('data-role="cta.headline"');
        expect(s, v.id).toContain('data-role="button.label" data-size="lg"');
      }
      if (v.block === "menu") {
        expect(s.split(MENU_PRICE_PLACEHOLDER).length - 1, v.id).toBe(3);
        expect(s, v.id).toContain('data-role="menu.price" data-placeholder="true"');
      }
    });
    expect(
      sec(
        html,
        variants.findIndex((v) => v.id === "pricing.cards"),
      ),
    ).toContain('data-featured="true"');
  });
  it("CSS 리터럴 0(CM-02)", () => {
    expect(cssLiteralViolations(CONTENT_B_CSS)).toEqual([]);
  });
});
