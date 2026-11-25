import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, type PTree } from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const T = (text: string, sub?: string) => ({
  text,
  placeholder: false,
  deck_ref: "deck:x#0",
  ...(sub !== undefined ? { sub } : {}),
});
const im = data.images[0]!;
const tree: PTree = {
  schemaVersion: "1",
  spec_id: "0123456789abcdef",
  pattern_id: "PS-1",
  nav: { variant: "nav.split", items: [{ label: "소개", target: "#story" }] },
  sections: [
    {
      id: "hero",
      block: "hero",
      variant: "hero.offset",
      bg: "bg",
      pad: 0,
      slots: {
        headline: { copy: T("같은 입력 같은 결과") },
        media: {
          image: { tag: "x", ratio: "4:5", asset_id: im.id, alt: "장면", focal: [0.3, 0.7] },
        },
      },
    },
    {
      id: "value",
      block: "value",
      variant: "value.icon-grid",
      bg: "surface",
      pad: 0,
      slots: { items: { list: [0, 1, 2].map((i) => ({ copy: T(`항목${i}`, "설명") })) } },
    },
    {
      id: "gallery",
      block: "gallery",
      variant: "gallery.masonry",
      bg: "bg",
      pad: 0,
      slots: {
        media: { image: { tag: "x", ratio: "1:1", asset_id: im.id, alt: "", focal: [0.5, 0.5] } },
        captions: { list: [0, 1, 2, 3].map((i) => ({ copy: T(`캡션${i}`) })) },
      },
    },
  ],
  footer: { variant: "footer.big-type", slots: { wordmark: { copy: T("한결") } } },
};

describe("9.4.4 ④ 결정성(CM-14, M2-07d)", () => {
  it("프리셋 8 × 같은 입력 100회 → HTML SHA-256 1종", () => {
    for (const p of data.presets) {
      const spec = {
        spec_id: "0123456789abcdef",
        variant: "v_true",
        type_id: p.typeId,
        purpose: "saas",
        theme: "light" as const,
        l2: p.l2 as Record<string, unknown>,
        tokens: deriveTokens({ presetId: p.id, l2: p.l2 }, data).tokenSet,
      };
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++)
        hashes.add(
          createHash("sha256")
            .update(compilePage(spec, structuredClone(tree), data).html)
            .digest("hex"),
        );
      expect(hashes.size, p.id).toBe(1);
    }
  });
});
