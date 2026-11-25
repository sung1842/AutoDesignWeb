// 텍스트 역할 층(03장 3.1.5a, B25 text-roles.json, AC-03-42·46). 블록·컴포넌트 템플릿은
// font-size를 쓰지 않고 data-role만 붙인다. 이 층이 역할 → 단계 토큰(--tf-type-*)·웨이트·행간·자간을 정한다.
// 순수 문자열 생성(isomorphic, 4.9.1). 값은 var(--tf-*)와 단위 없는 수만(CM-02). ASM-043.

export interface TextRole {
  id: string;
  stepDesktop: string;
  weight: string; // heading | body | emphasis
  leading: string; // heading | body | 숫자 문자열
  trackingClass: string; // heading | body | label
  stepVariants?: string[];
}

/** 3.1.5 단계 이름 → 토큰 키(--tf-type-<키>). */
export const STEP_TOKEN: Readonly<Record<string, string>> = {
  "t-display": "display",
  "t-1": "h1",
  "t-2": "h2",
  "t-3": "h3",
  "t-4": "h4",
  "t-lead": "lead",
  "t-body": "body",
  "t-small": "small",
  "t-caption": "caption",
};

/** stepRuleKo의 조건부 단계(3.1.5a 표). 선택자 문맥 → 단계. nav.link·nav.wordmark는 컴파일 시 결정. */
export const STEP_VARIANT_RULES: Readonly<
  Record<string, readonly { ctx: string; step: string }[]>
> = {
  "hero.headline": [
    { ctx: ".tf-hero--type-only", step: "t-display" },
    { ctx: ".tf-hero--full-bleed-image", step: "t-display" },
  ],
  "cta.headline": [{ ctx: ".tf-cta--big-type", step: "t-display" }],
  "footer.wordmark": [{ ctx: ".tf-footer--big-type", step: "t-display" }],
  "button.label": [{ ctx: "&[data-size='sm']", step: "t-small" }],
};

/** 3.1.5a 표 수치(nav.link: 데스크톱 t-small이 이 px 미만이면 t-body). */
export const TEXT_ROLE_SPEC = { navLinkMinPx: 15 } as const;

const TABULAR = new Set(["stat.value", "pricing.price", "menu.price"]);

export interface TextRoleOpts {
  /** 토큰 t-small의 데스크톱 px. 15 미만이면 nav.link를 t-body로(3.1.5a). */
  smallPx?: number;
}

function tok(step: string): string {
  const k = STEP_TOKEN[step];
  if (!k) throw new Error(`알 수 없는 단계 ${step}`);
  return k;
}

function sizeDecls(step: string, r: TextRole): string[] {
  const k = tok(step);
  const lh =
    r.leading === "heading"
      ? `var(--tf-type-${k}-leading)`
      : r.leading === "body"
        ? "var(--tf-type-leading-body)"
        : r.leading;
  const ls = r.trackingClass === "heading" ? `var(--tf-type-${k}-tracking)` : "0";
  return [`font-size: var(--tf-type-${k})`, `line-height: ${lh}`, `letter-spacing: ${ls}`];
}

/** 역할 1개의 규칙들. */
export function roleRules(r: TextRole, opts: TextRoleOpts = {}): string[] {
  const sel = `[data-role="${r.id}"]`;
  let step = r.stepDesktop;
  if (
    r.id === "nav.link" &&
    opts.smallPx !== undefined &&
    opts.smallPx < TEXT_ROLE_SPEC.navLinkMinPx
  )
    step = "t-body";
  const fam = r.weight === "heading" ? "var(--tf-font-heading)" : "var(--tf-font-body)";
  const wt =
    r.weight === "heading"
      ? "var(--tf-font-weight-heading)"
      : r.weight === "emphasis"
        ? "var(--tf-font-weight-emphasis)"
        : "var(--tf-font-weight-body)";
  const decls = [`font-family: ${fam}`, `font-weight: ${wt}`, ...sizeDecls(step, r)];
  if (TABULAR.has(r.id)) decls.push("font-variant-numeric: tabular-nums");
  const out = [`${sel} { ${decls.join("; ")}; }`];
  for (const v of STEP_VARIANT_RULES[r.id] ?? []) {
    const s = v.ctx.startsWith("&") ? `${sel}${v.ctx.slice(1)}` : `${v.ctx} ${sel}`;
    out.push(`${s} { ${sizeDecls(v.step, r).join("; ")}; }`);
  }
  return out;
}

/** 확정 트리 role_overrides(3.8.1 단계 하향) → [data-step]. 역할 규칙 뒤에 두어 문맥 규칙보다 이긴다(ASM-064). */
export function stepOverrideCss(): string {
  return Object.entries(STEP_TOKEN)
    .map(
      ([step, k]) =>
        `[data-role][data-step="${step}"] { font-size: var(--tf-type-${k}); line-height: var(--tf-type-${k}-leading); letter-spacing: var(--tf-type-${k}-tracking); }`,
    )
    .join("\n");
}

/** text-roles.css 본문. 역할 순서는 B25 순서 그대로(결정론, CM-14). */
export function textRoleCss(roles: readonly TextRole[], opts: TextRoleOpts = {}): string {
  return `/* TasteFit text-roles.css (B25) */\n${roles.flatMap((r) => roleRules(r, opts)).join("\n")}\n${stepOverrideCss()}\n`;
}
