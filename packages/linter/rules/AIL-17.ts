// AIL-17 스케일 밖 값(04장 4.13.2, D). 기준 = 하네스가 spec.tokens로 만든 TokenSet. 토큰이 없으면 검사하지 않는다.
import { deltaEOk, finding, params, parseColor } from "../src/lib.js";
import type { LintFinding, Rule, SnapEl, TokenSet } from "../src/types.js";

interface P {
  deltaEOk: number;
  pxTol: number;
}
function check(e: SnapEl, t: TokenSet, p: P, colors: ReturnType<typeof parseColor>[]): string[] {
  const bad: string[] = [];
  const near = (v: number, set: number[]): boolean => set.some((x) => Math.abs(x - v) <= p.pxTol);
  for (const [k, c] of [
    ["color", e.color],
    ["background", e.bgColor],
    ...(e.borderWidth > 0 ? [["border", e.borderColor]] : []),
  ] as [string, string][]) {
    const lc = parseColor(c);
    if (!lc || lc.alpha === 0) continue;
    if (!colors.some((x) => x && deltaEOk(x, { ...lc, alpha: 1 }) <= p.deltaEOk))
      bad.push(`${k} ${c}`);
  }
  if (e.radius > 0 && !near(e.radius, t.radii)) bad.push(`radius ${e.radius}px`);
  if (!e.wordmark && e.step && t.fontSizes[e.step] !== undefined) {
    const want = t.fontSizes[e.step] ?? 0;
    if (Math.abs(e.fontSize - want) > p.pxTol) bad.push(`font-size ${e.fontSize}px ≠ ${want}`);
  }
  if (!e.layoutAuto) {
    const sp = [...e.padding, ...e.gap, ...(e.marginAuto ? [] : e.margin)].filter((v) => v > 0);
    for (const v of sp) if (!near(v, t.spacing)) bad.push(`spacing ${v}px`);
  }
  return bad;
}

export const rule: Rule = {
  id: "AIL-17",
  stage: ["D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "디자인 토큰 스케일에 없는 색·모서리·크기·간격 값이 쓰였습니다.",
  fixHint: "토큰 집합의 가장 가까운 값으로 바꾸세요.",
  check(ctx) {
    const s = ctx.snapshot;
    if (!s || !s.tokens) return [];
    const p = params<P>("AIL-17");
    const colors = s.tokens.colors.map(parseColor);
    const out: LintFinding[] = [];
    for (const e of s.elements)
      for (const b of check(e, s.tokens, p, colors))
        out.push(finding("AIL-17", "error", `${e.tag}${e.role ? `[${e.role}]` : ""} ${b}`));
    return out;
  },
};
