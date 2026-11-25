import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations, type PTree } from "../index.js";
import { HERO_CSS } from "../css/blocks/hero.js";
import { HERO_TEMPLATES } from "./hero.js";

const ROOT = join(import.meta.dirname, "../../../..");
const data = loadDesignData(ROOT);
const hero = data.blocks.find((b) => b.id === "hero") as unknown as {
  variants: { id: string; image: { ratios: string[] } | null; text_cols: { lg: number } }[];
};
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
const T = (text: string) => ({ text, placeholder: false, deck_ref: "deck:x#0" });
function treeFor(v: { id: string; image: { ratios: string[] } | null }): PTree {
  const ratio = v.image?.ratios[0];
  return {
    schemaVersion: "1",
    spec_id: spec.spec_id,
    pattern_id: "PS-1",
    nav: { variant: "nav.split", items: [] },
    sections: [
      {
        id: "hero",
        block: "hero",
        variant: v.id,
        bg: v.id === "hero.full-bleed-image" ? "image" : "bg",
        pad: 0,
        slots: {
          eyebrow: { copy: T("작은 팀") },
          headline: { copy: T("제목입니다") },
          sub: { copy: T("설명") },
          primaryCta: { link: { label: T("시작"), target: "#hero" } },
          ...(ratio
            ? {
                media: {
                  image: {
                    tag: "x",
                    ratio,
                    asset_id: data.images[0]!.id,
                    alt: "화면",
                    focal: [0.5, 0.5] as [number, number],
                  },
                },
              }
            : {}),
        },
      },
    ],
    footer: { variant: "footer.minimal", slots: { wordmark: { copy: T("한결") } } },
  };
}

describe("hero 6 variant(M2-06b1, ASM-044)", () => {
  it("blocks.json hero variant 전부에 템플릿이 있다", () => {
    expect(Object.keys(HERO_TEMPLATES).sort()).toEqual(hero.variants.map((v) => v.id).sort());
  });

  it("variant마다 h1 1개가 텍스트 칼럼 안, 이미지 variant는 미디어 슬롯, CTA는 lg 버튼", () => {
    for (const v of hero.variants) {
      const html = compilePage(spec, treeFor(v), data).html;
      expect(html.match(/<h1[ >]/g), v.id).toHaveLength(1);
      expect(html, v.id).toMatch(
        /class="tf-hero__text"><p[^>]*data-role="eyebrow"[^>]*>[^<]*<\/p><h1 /,
      );
      expect(html.includes('data-slot-id="hero.media"'), v.id).toBe(v.image !== null);
      expect(html, v.id).toContain('data-role="button.label" data-size="lg"');
      expect(html, v.id).toContain(`tf-${v.id.replace(".", "--")}`);
    }
  });

  it("offset 보조 이미지는 장식(aria-hidden), full-bleed는 텍스트 오버레이", () => {
    const off = compilePage(
      spec,
      treeFor(hero.variants.find((v) => v.id === "hero.offset")!),
      data,
    ).html;
    expect(off).toMatch(/tf-hero__media--secondary" aria-hidden="true"/);
    const fb = compilePage(
      spec,
      treeFor(hero.variants.find((v) => v.id === "hero.full-bleed-image")!),
      data,
    ).html;
    expect(fb).toMatch(/tf-hero__stage.*tf-hero__overlay/);
  });

  it("hero.css 텍스트 칸 = text_cols.lg(12열), 리터럴 0", () => {
    for (const v of hero.variants) {
      const n = v.text_cols.lg;
      const sel = `.tf-${v.id.replace(".", "--")}`;
      if (v.id === "hero.full-bleed-image") expect(HERO_CSS).toContain(`calc(100% * ${n} / 12)`);
      else if (v.id === "hero.centered")
        expect(HERO_CSS).toContain(
          `${sel} .tf-hero__text { grid-column: ${(12 - n) / 2 + 1} / span ${n}; }`,
        );
      else
        expect(HERO_CSS, v.id).toMatch(
          new RegExp(`\\${sel} \\.tf-hero__text \\{ grid-column: 1 / span ${n};`),
        );
    }
    expect(cssLiteralViolations(HERO_CSS)).toEqual([]);
  });
});
