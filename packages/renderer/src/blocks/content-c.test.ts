import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations, type PTree } from "../index.js";
import { CONTENT_C_CSS } from "../css/blocks/content-c.js";
import { CONTENT_C_TEMPLATES } from "./content-c.js";

const ROOT = join(import.meta.dirname, "../../../..");
const data = loadDesignData(ROOT);
const BLOCKS = ["highlight", "gallery", "location", "story", "about", "service", "contact"];
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
const img = { image: { tag: "x", ratio: "4:5", asset_id: "a1", alt: "사진", focal: [0.5, 0.5] } };
const list = (n: number, sub = true) => ({
  list: Array.from({ length: n }, (_, i) => ({
    copy: T(`항목${i}`, sub ? `설명${i}` : undefined),
  })),
});
const SLOTS: Record<string, Record<string, unknown>> = {
  highlight: { items: list(3), media: img },
  gallery: { media: img, captions: list(6, false) },
  location: {
    address: { copy: T("서울") },
    hours: { copy: T("10–21시") },
    phone: { copy: T("02-000-0000") },
  },
  story: { body: { copy: T("본문") }, media: img },
  about: { title: { copy: T("소개") }, body: { copy: T("본문") }, media: img },
  service: { items: list(3) },
  contact: {
    title: { copy: T("문의") },
    body: { copy: T("본문") },
    contactInfo: { copy: T("a@b.c") },
    form: { copy: T("안내") },
  },
};
const variants = data.blocks
  .filter((b) => BLOCKS.includes(b.id as string))
  .flatMap((b) =>
    (b.variants as { id: string }[]).map((v) => ({ block: b.id as string, id: v.id })),
  );
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
      slots: SLOTS[v.block],
    })),
    footer: { variant: "footer.minimal", slots: { wordmark: { copy: T("한결") } } },
  }) as PTree;
const inner = (html: string, i: number): string => {
  const a = html.indexOf(`<section id="s${i}"`);
  return html.slice(html.indexOf(">", a) + 1, html.indexOf("</section>", a));
};

describe("highlight·gallery·location·story·about·service·contact 템플릿(M2-06b2c, ASM-047)", () => {
  it("7블록 variant 전부에 템플릿이 있다", () => {
    expect(Object.keys(CONTENT_C_TEMPLATES).sort()).toEqual(variants.map((v) => v.id).sort());
  });
  it("섹션 안 요소는 섹션 클래스(tf-<블록>, tf-<블록>--<variant>)를 쓰지 않는다", () => {
    const html = compilePage(spec, tree(), data).html;
    variants.forEach((v, i) => {
      const s = inner(html, i);
      expect(s.match(/<h2 /g), v.id).toHaveLength(1);
      const re = new RegExp(`class="[^"]*\\btf-${v.block}(--[a-z-]+)?(?=[" ])`);
      expect(re.test(s), v.id).toBe(false);
    });
  });
  it("gallery 칸 = 캡션 수, 실제 이미지는 첫 칸만(BLK-010), contact 폼은 action 없음·라벨 연결", () => {
    const html = compilePage(spec, tree(), data).html;
    const g = inner(
      html,
      variants.findIndex((v) => v.id === "gallery.grid"),
    );
    expect(g.match(/<figure /g)).toHaveLength(6);
    expect(g.match(/data-asset-id=/g)).toHaveLength(1);
    expect(g.match(/data-media-empty="true"/g)).toHaveLength(5);
    const c = inner(
      html,
      variants.findIndex((v) => v.id === "contact.split-form"),
    );
    expect(c).not.toMatch(/<form[^>]*action=/);
    for (const id of ["name", "email", "message"]) {
      const fid = `s${variants.findIndex((v) => v.id === "contact.split-form")}-${id}`;
      expect(c).toContain(`for="${fid}"`);
      expect(c).toContain(`id="${fid}"`);
    }
    expect(c).not.toContain("</input>");
  });
  it("CSS 리터럴 0(CM-02)", () => {
    expect(cssLiteralViolations(CONTENT_C_CSS)).toEqual([]);
  });
});
