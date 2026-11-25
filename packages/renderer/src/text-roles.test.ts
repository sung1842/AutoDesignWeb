import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveTokens, loadDesignData } from "@tastefit/design-spec";
import { rootCss } from "@tastefit/design-spec/tokens-css";
import { compilePage, cssLiteralViolations, type PTree } from "./index.js";
import { STEP_TOKEN, STEP_VARIANT_RULES, textRoleCss, type TextRole } from "./css/text-roles.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const roles = data.textRoles as unknown as (TextRole & { stepVariants?: string[] })[];
const VOID = new Set(["meta", "link", "input", "img", "br", "hr", "source", "area", "col", "wbr"]);

/** body 안 텍스트 노드마다 가장 가까운 data-role(없으면 null). aria-hidden 하위는 건너뛴다. */
function textNodeRoles(html: string): (string | null)[] {
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  const stack: { tag: string; role: string | null; hidden: boolean }[] = [];
  const out: (string | null)[] = [];
  const re = /<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  for (const m of body.matchAll(re)) {
    if (m[4] !== undefined) {
      if (m[4].trim() === "" || stack.some((s) => s.hidden)) continue;
      out.push([...stack].reverse().find((s) => s.role)?.role ?? null);
      continue;
    }
    const tag = (m[2] ?? "").toLowerCase();
    if (m[1]) {
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      continue;
    }
    if (VOID.has(tag) || (m[3] ?? "").endsWith("/")) continue;
    const a = m[3] ?? "";
    stack.push({
      tag,
      role: /data-role="([^"]+)"/.exec(a)?.[1] ?? null,
      hidden: /aria-hidden="true"/.test(a),
    });
  }
  return out;
}

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
const T = (text: string, placeholder = false) => ({ text, placeholder, deck_ref: "deck:x#0" });
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
        eyebrow: { copy: T("새 소식") },
        headline: { copy: T("제목") },
        sub: { copy: T("설명") },
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
    {
      id: "cta",
      block: "cta",
      variant: "cta.big-type",
      bg: "inverse",
      pad: 0,
      slots: {
        headline: { copy: T("지금 시작") },
        primaryCta: { link: { label: T("문의"), target: "#main" } },
      },
    },
  ],
  footer: {
    variant: "footer.minimal",
    slots: {
      wordmark: { copy: T("한결") },
      tagline: { copy: T("한 줄") },
      links: { list: [{ copy: T("개인정보") }] },
      businessInfo: { copy: T("상호 한결", true) },
    },
  },
};

describe("텍스트 역할 층(3.1.5a, ASM-043)", () => {
  it("B25 전 역할이 규칙을 갖고, 단계가 토큰에 대응하며, 리터럴 0(CM-02)", () => {
    const css = textRoleCss(roles, { smallPx: 14 });
    for (const r of roles) expect(css, r.id).toContain(`[data-role="${r.id}"]`);
    for (const r of roles)
      for (const s of [r.stepDesktop, ...(r.stepVariants ?? [])])
        expect(STEP_TOKEN[s], `${r.id} ${s}`).toBeDefined();
    expect(cssLiteralViolations(css)).toEqual([]);
    expect(css).not.toMatch(/font-size:\s*[0-9.]+(px|rem|em)/);
    // nav.link: t-small < 15px면 t-body
    expect(css).toMatch(/\[data-role="nav.link"\][^}]*--tf-type-body\)/);
    expect(textRoleCss(roles, { smallPx: 15 })).toMatch(
      /\[data-role="nav.link"\][^}]*--tf-type-small\)/,
    );
  });

  it("조건부 단계 규칙은 B25 stepVariants 안의 단계만 쓴다", () => {
    for (const [id, rules] of Object.entries(STEP_VARIANT_RULES)) {
      const r = roles.find((x) => x.id === id);
      expect(r, id).toBeDefined();
      for (const v of rules) expect(r?.stepVariants ?? [], id).toContain(v.step);
    }
  });

  it("tokens.css에 단계별 -leading·-tracking 변수가 있다", () => {
    const css = rootCss(spec.tokens, "t");
    for (const k of Object.values(STEP_TOKEN)) {
      expect(css).toContain(`--tf-type-${k}-leading:`);
      expect(css).toContain(`--tf-type-${k}-tracking:`);
    }
    expect(css.match(/:root\s*\{/g)).toHaveLength(1);
  });

  it("컴파일 결과의 모든 텍스트 노드가 B25 역할 안에 있다(AC-03-42 정적 근사)", () => {
    const html = compilePage(spec, tree, data).html;
    const ids = new Set(roles.map((r) => r.id));
    const got = textNodeRoles(html);
    expect(got.length).toBeGreaterThan(10);
    expect(got.filter((r) => r === null || !ids.has(r))).toEqual([]);
    expect(html).toContain('data-role="button.label" data-size="md"');
    expect(html).toContain('data-role="cta.headline"');
    expect(html).toContain('data-role="eyebrow"');
    expect(html).toContain('[data-role="hero.headline"]');
  });
});
