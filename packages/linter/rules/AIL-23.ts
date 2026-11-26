// AIL-23 템플릿 잔여물(04장 4.13.2, C·D). CP-10 예시값·[예시] 접두 문구는 제외.
import { EXAMPLE_PREFIX, finding, params } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  pattern: string;
  flags: string;
}
/** CP-10 예시값(04장 4.6.3 CP-10). */
const CP10 = /^(02-000-0000|hello@example\.com|서울시 ○○구 ○○로 00|000-00-00000)$/;
export const rule: Rule = {
  id: "AIL-23",
  stage: ["C", "D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "템플릿 자리표시 문구가 남아 있습니다.",
  fixHint: "실제 문구로 바꾸거나 '[예시]'를 붙인 자리표시로 표시하세요.",
  check(ctx) {
    const p = params<P>("AIL-23");
    const re = new RegExp(p.pattern, p.flags);
    const texts = [
      ...(ctx.copy ?? []).map((c) => c.text),
      ...(ctx.snapshot?.elements ?? []).map((e) => e.text),
    ];
    const out: LintFinding[] = [];
    for (const t of texts) {
      if (!t || EXAMPLE_PREFIX.test(t) || CP10.test(t.trim())) continue;
      const m = re.exec(t);
      if (m) out.push(finding("AIL-23", "error", `템플릿 잔여물 "${m[0]}"`));
    }
    return out;
  },
};
