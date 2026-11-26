// AIL-24 헤드라인 줄 문제(04장 4.13.2, D): hero 헤드라인 375 > 3줄 ∨ 1280 > 2줄 ∨ 마지막 줄 ≤ 2글자.
import { finding, params } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  maxLines: Record<string, number>;
  orphanMaxChars: number;
  orphanMinLines: number;
}
export const rule: Rule = {
  id: "AIL-24",
  stage: ["D"],
  severity: ["warn"],
  appliesTo: ["M", "U"],
  messageKo: "히어로 헤드라인 줄 수가 많거나 마지막 줄이 너무 짧습니다.",
  fixHint: "헤드라인을 줄이거나 균형 줄바꿈으로 마지막 줄을 3글자 이상으로 맞추세요.",
  check(ctx) {
    const s = ctx.snapshot;
    if (!s) return [];
    const p = params<P>("AIL-24");
    const max = p.maxLines[String(s.vw)];
    const out: LintFinding[] = [];
    for (const h of s.headlines.filter((x) => x.role === "hero.headline")) {
      if (max !== undefined && h.lines > max)
        out.push(finding("AIL-24", "warn", `${s.vw}px 헤드라인 ${h.lines}줄 > ${max}`));
      if (h.lines >= p.orphanMinLines && h.lastLineChars <= p.orphanMaxChars)
        out.push(finding("AIL-24", "warn", `마지막 줄 ${h.lastLineChars}글자(고아)`));
    }
    return out;
  },
};
