// AIL-20 느낌표 과다(04장 4.13.2, C): 헤드라인 느낌표 ≥ 1(T-PLAYFUL 제외) ∨ 페이지 합계 > spec.copy.exclaim_max_per_page.
import { finding, isObj, params } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

const bangs = (s: string): number => (s.match(/[!！]/g) ?? []).length;
export const rule: Rule = {
  id: "AIL-20",
  stage: ["C"],
  severity: ["warn"],
  appliesTo: ["M", "U"],
  messageKo: "느낌표가 많아 과장된 광고처럼 읽힙니다.",
  fixHint: "헤드라인의 느낌표를 빼고 페이지 전체 느낌표 수를 줄이세요.",
  check(ctx) {
    if (!ctx.copy) return [];
    const copy = ctx.spec && isObj(ctx.spec.copy) ? ctx.spec.copy : {};
    const tone = typeof copy.tone_id === "string" ? copy.tone_id : "";
    const max = typeof copy.exclaim_max_per_page === "number" ? copy.exclaim_max_per_page : null;
    const out: LintFinding[] = [];
    if (tone !== params<{ exemptTone: string }>("AIL-20").exemptTone)
      for (const c of ctx.copy.filter((x) => x.role.includes("headline")))
        if (bangs(c.text) > 0) out.push(finding("AIL-20", "warn", `${c.role} 느낌표 "${c.text}"`));
    const total = ctx.copy.reduce((a, c) => a + bangs(c.text), 0);
    if (max !== null && total > max)
      out.push(finding("AIL-20", "warn", `페이지 느낌표 ${total} > ${max}`));
    return out;
  },
};
