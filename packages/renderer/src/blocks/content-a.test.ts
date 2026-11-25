import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations, type PTree } from "../index.js";
import { CONTENT_A_CSS, LAYOUT_CSS } from "../css/blocks/content-a.js";
import { CONTENT_A_TEMPLATES } from "./content-a.js";

const ROOT = join(import.meta.dirname, "../../../..");
const data = loadDesignData(ROOT);
const BLOCKS = ["value", "feature", "showcase", "stats", "process"];
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
const T = (text: string, sub?: string) => ({
  text,
  placeholder: false,
  deck_ref: "deck:x#0",
  ...(sub !== undefined ? { sub } : {}),
});
const list = { list: [0, 1, 2].map((i) => ({ copy: T(`항목${i}`, `설명${i}`) })) };
const img = {
  image: {
    tag: "x",
    ratio: "16:9",
    asset_id: "a1",
    alt: "화면",
    focal: [0.5, 0.5] as [number, number],
  },
};
const variants = data.blocks
  .filter((b) => BLOCKS.includes(b.id as string))
  .flatMap((b) =>
    (b.variants as { id: string }[]).map((v) => ({ block: b.id as string, id: v.id })),
  );

function tree(): PTree {
  return {
    schemaVersion: "1",
    spec_id: spec.spec_id,
    pattern_id: "PS-1",
    nav: { variant: "nav.split", items: [] },
    sections: variants.map((v, i) => ({
      id: `s${i}`,
      block: v.block,
      variant: v.id,
      bg: "bg" as const,
      pad: 0 as const,
      slots:
        v.block === "showcase"
          ? { media: img, caption: { copy: T("캡션") } }
          : { items: list, ...(v.block === "feature" ? { media: img } : {}) },
    })),
    footer: { variant: "footer.minimal", slots: { wordmark: { copy: T("한결") } } },
  };
}

describe("value·feature·showcase·stats·process 템플릿(M2-06b2a, ASM-045)", () => {
  it("5블록 variant 전부에 템플릿이 있다", () => {
    expect(Object.keys(CONTENT_A_TEMPLATES).sort()).toEqual(variants.map((v) => v.id).sort());
  });
  it("섹션마다 h2 제목 1개, 항목 3개 전부, 번호 variant는 01~03", () => {
    const html = compilePage(spec, tree(), data).html;
    for (let i = 0; i < variants.length; i++) {
      const sec = html.slice(
        html.indexOf(`<section id="s${i}"`),
        html.indexOf("</section>", html.indexOf(`<section id="s${i}"`)),
      );
      const v = variants[i]!;
      expect(sec.match(/<h2 /g), v.id).toHaveLength(1);
      if (v.block === "showcase") {
        expect(sec, v.id).toMatch(/<figcaption[^>]*data-role="caption"/);
        continue;
      }
      for (const k of [0, 1, 2]) expect(sec, v.id).toContain(`data-slot-id="s${i}.items.${k}"`);
      if (["value.numbered", "process.horizontal", "process.vertical"].includes(v.id))
        expect(sec, v.id).toContain('data-role="list.index" aria-hidden="true">03<');
    }
    expect(html).toContain('data-role="stat.value"');
    const ig = html.slice(html.indexOf('data-variant="value.icon-grid"'));
    const grid = ig.slice(0, ig.indexOf("</section>"));
    expect(grid.match(/<svg /g)).toHaveLength(3);
    expect(grid).toContain(`data-icon-set="${String(spec.l2["icon.set"])}"`);
  });
  it("CSS 리터럴 0(CM-02)", () => {
    expect(cssLiteralViolations(LAYOUT_CSS + CONTENT_A_CSS)).toEqual([]);
  });
});
