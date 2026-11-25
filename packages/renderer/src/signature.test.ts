import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadDesignData, standardTree } from "@tastefit/design-spec";
import { compilePage, cssLiteralViolations } from "./index.js";
import { isLatinLabel, scriptAttr, signatureRoleCss } from "./signature.js";
import type { TextRole } from "./css/text-roles.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
type Spec = { signature: { id: string; intensity: 1 | 2; apply_to: string[] } };

describe("시그니처 층(4.14·3.2.4, M2-09d4a, ASM-069)", () => {
  it("8유형 표준 명세: 루트 data-signature = spec.signature.id, 적용 블록마다 data-sig", () => {
    for (const p of data.presets) {
      const { spec, tree } = standardTree(p.typeId, "saas", data);
      const sig = (spec as unknown as Spec).signature;
      const { html } = compilePage(spec, tree, data);
      const root = /<html[^>]*>/.exec(html)?.[0] ?? "";
      expect(root).toContain(`data-signature="${sig.id}"`);
      const blocks = [...html.matchAll(/data-block="([a-z]+)"[^>]*data-sig="on"/g)].map(
        (m) => m[1],
      );
      for (const b of blocks) expect(sig.apply_to).toContain(b);
    }
  });

  it("요소형 시그니처: SIG-06 마키·SIG-07 그레인·SIG-11 아웃라인은 aria-hidden 장식", () => {
    const { spec, tree } = standardTree("T1", "saas", data);
    const base = spec as unknown as Spec & Record<string, unknown>;
    const cases: [string, string[], RegExp][] = [
      ["SIG-06", ["cta"], /<div class="tf-marquee" aria-hidden="true" data-sig-el="SIG-06">/],
      ["SIG-07", ["page"], /<svg class="tf-grain" aria-hidden="true"/],
      ["SIG-11", ["hero"], /<p class="tf-sig-outline" aria-hidden="true" data-sig-el="SIG-11"/],
    ];
    for (const [id, apply_to, re] of cases) {
      const s = { ...base, signature: { id, intensity: 2, apply_to } };
      const { html } = compilePage(s, tree, data);
      expect(html, id).toMatch(re);
    }
    // 시그니처 없음 → 장식 요소 없음
    const { html } = compilePage({ ...base, signature: undefined }, tree, data);
    expect(/<html[^>]*>/.exec(html)?.[0]).not.toMatch(/data-signature=/);
    expect(html.split("<body>")[1]).not.toMatch(/data-sig-el|data-sig=/);
  });

  it("SIG-09: 라틴 라벨만 data-script, 생성 CSS는 리터럴 없음(CM-02)", () => {
    expect(isLatinLabel("ABOUT US")).toBe(true);
    expect(isLatinLabel("소개")).toBe(false);
    expect(isLatinLabel("2026")).toBe(false);
    expect(scriptAttr("eyebrow", "New")).toBe("latin");
    expect(scriptAttr("body", "New")).toBeNull();
    const css = signatureRoleCss(data.textRoles as unknown as TextRole[], { smallPx: 14 });
    expect(cssLiteralViolations(css)).toEqual([]);
    expect(css).toMatch(/\[data-role="nav.link"\][^}]*--tf-type-body\) \* 0.02/);
    expect(css).toMatch(/\[data-role="eyebrow"\]\[data-script="latin"\][^}]*\* 0.08/);
  });
});
