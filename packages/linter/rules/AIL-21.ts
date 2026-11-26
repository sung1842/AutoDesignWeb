// AIL-21 근거 없는 주장(04장 4.13.2, C·08장 AC-08-28): [예시] 접두 없는 숫자+단위·최상급·수상·평점이 BrandInput에 없음.
import { EXAMPLE_PREFIX, brandText, finding, norm, params } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  claimPattern: string;
  flags: string;
}
export const rule: Rule = {
  id: "AIL-21",
  stage: ["C"],
  severity: ["error"],
  appliesTo: ["M"],
  messageKo: "입력에 없는 수치·최상급 주장은 근거 없는 광고 문구입니다.",
  fixHint: "입력한 사실만 쓰거나 '[예시]'를 붙여 자리표시로 남기세요.",
  check(ctx) {
    if (!ctx.copy) return [];
    const p = params<P>("AIL-21");
    const re = new RegExp(p.claimPattern, `${p.flags}g`);
    const known = brandText(ctx.brand).replace(/\s/g, "");
    const out: LintFinding[] = [];
    for (const c of ctx.copy) {
      if (EXAMPLE_PREFIX.test(c.text)) continue;
      for (const m of norm(c.text).matchAll(re)) {
        const v = (m[0] ?? "").replace(/\s/g, "");
        if (!known.includes(v))
          out.push(finding("AIL-21", "error", `${c.role}: "${m[0]}" 입력에 없음`));
      }
    }
    return out;
  },
};
