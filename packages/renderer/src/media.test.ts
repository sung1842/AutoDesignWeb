import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations, focalCss, imageUrl, type PTree } from "./index.js";
import { MEDIA_BLOCK_CSS } from "./css/blocks/media.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const T = (text: string) => ({ text, placeholder: false, deck_ref: "deck:x#0" });
const im = data.images[0]!;
const tree: PTree = {
  schemaVersion: "1",
  spec_id: "0123456789abcdef",
  pattern_id: "PS-1",
  nav: { variant: "nav.split", items: [] },
  sections: [
    {
      id: "hero",
      block: "hero",
      variant: "hero.split",
      bg: "bg",
      pad: 0,
      slots: {
        headline: { copy: T("제목") },
        media: {
          image: { tag: "x", ratio: "4:5", asset_id: im.id, alt: "작업 공간", focal: [0.46, 0.51] },
        },
      },
    },
    {
      id: "story",
      block: "story",
      variant: "story.split",
      bg: "bg",
      pad: 0,
      slots: {
        body: { copy: T("본문") },
        media: {
          image: { tag: "x", ratio: "4:5", asset_id: "없는-자산", alt: "가게", focal: [0.5, 0.5] },
        },
      },
    },
  ],
  footer: { variant: "footer.minimal", slots: { wordmark: { copy: T("한결") } } },
};
const specOf = (typeId: string) => {
  const p = data.presets.find((x) => x.typeId === typeId)!;
  return {
    spec_id: "0123456789abcdef",
    variant: "v_true",
    type_id: p.typeId,
    purpose: "local_business",
    theme: "light" as const,
    l2: p.l2 as Record<string, unknown>,
    tokens: deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet,
  };
};

describe("미디어 슬롯(3.10·3.10.5, ASM-052)", () => {
  it("photo-led: 이미지 팩 로컬 경로·width/height(슬롯 비율)·hero eager, 없는 자산은 색면", () => {
    const html = compilePage(specOf("T1"), tree, data).html;
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    const tag = imgs[0]!;
    expect(tag).toContain(`src="${imageUrl(im.path)}"`);
    expect(imageUrl(im.path).startsWith("/assets/images/")).toBe(true);
    expect(tag).toMatch(/width="\d+" height="\d+"/);
    const [w, h] = [Number(/width="(\d+)"/.exec(tag)![1]), Number(/height="(\d+)"/.exec(tag)![1])];
    expect(Math.abs(h / w - 5 / 4)).toBeLessThan(0.01);
    expect(tag).toContain('loading="eager"');
    expect(tag).toContain('data-fx="50" data-fy="50"');
    expect(html).toMatch(
      /data-media-slot="x" data-slot-id="story.media"><div[^>]*data-shape-graphic="G[1-4]"/,
    );
    expect(html).not.toMatch(/<img [^>]*src="(https?:)?\/\//);
  });
  it("shape-graphic 프리셋은 사진 0장, 모든 미디어 슬롯에 색면, 같은 입력 같은 구성", () => {
    const sg = data.presets.find((p) => p.l2["media.mode"] === "shape-graphic")!;
    const a = compilePage(specOf(sg.typeId), tree, data).html;
    expect(a).not.toContain("<img ");
    expect(a.match(/data-shape-graphic=/g)).toHaveLength(2);
    expect(compilePage(specOf(sg.typeId), tree, data).html).toBe(a);
  });
  it("CSS: 색면 층 리터럴 0, 초점 규칙 11 × 2 + 기본", () => {
    expect(cssLiteralViolations(MEDIA_BLOCK_CSS)).toEqual([]);
    expect(focalCss().match(/data-f[xy]=/g)).toHaveLength(22);
  });
});
