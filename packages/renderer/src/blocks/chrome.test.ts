import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations, STICKY_NAV_TYPES, type PTree } from "../index.js";
import { CHROME_CSS } from "../css/blocks/chrome.js";

const ROOT = join(import.meta.dirname, "../../../..");
const data = loadDesignData(ROOT);
const T = (text: string) => ({ text, placeholder: false, deck_ref: "deck:x#0" });
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
const tree = (nav: string, footer: string): PTree => ({
  schemaVersion: "1",
  spec_id: "0123456789abcdef",
  pattern_id: "PS-1",
  nav: { variant: `nav.${nav}`, items: [{ label: "기능", target: "#main" }] },
  sections: [],
  footer: {
    variant: `footer.${footer}`,
    slots: {
      wordmark: { copy: T("한결") },
      tagline: { copy: T("한 줄") },
      links: { list: [{ copy: T("약관") }] },
      businessInfo: { copy: T("상호 한결") },
    },
  },
});

describe("nav·footer variant(M2-06b2d, ASM-048)", () => {
  it("footer variant별 칸 구성", () => {
    const s = specFor(0);
    const cols = compilePage(s, tree("split", "columns"), data).html;
    expect(cols.match(/class="tf-footer__col"/g)).toHaveLength(3);
    const big = compilePage(s, tree("split", "big-type"), data).html;
    const f = big.slice(big.indexOf("<footer"));
    expect(f.indexOf("tf-wordmark--big-type")).toBeGreaterThan(f.indexOf("tf-footer__biz"));
    const min = compilePage(s, tree("minimal", "minimal"), data).html;
    expect(min).not.toContain('class="tf-footer__col"');
    expect(min).toContain("tf-navbar--minimal");
  });
  it("sticky는 T2·T7 프리셋만(C08)", () => {
    data.presets.forEach((p, i) => {
      const html = compilePage(specFor(i), tree("split", "minimal"), data).html;
      expect(/class="tf-navbar[^"]*tf-navbar--sticky/.test(html), p.id).toBe(
        STICKY_NAV_TYPES.has(p.typeId),
      );
    });
  });
  it("CSS 리터럴 0(CM-02)", () => {
    expect(cssLiteralViolations(CHROME_CSS)).toEqual([]);
  });
});
