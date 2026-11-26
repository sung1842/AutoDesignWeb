// AIL-22 가짜 후기(04장 4.13.2, C): proof 인용에 [예시] 접두 없음 ∨ 이름이 "성○○" 형식 아님.
import { EXAMPLE_PREFIX, finding, norm, params } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

export const rule: Rule = {
  id: "AIL-22",
  stage: ["C"],
  severity: ["error"],
  appliesTo: ["M"],
  messageKo: "실제 고객처럼 보이는 가짜 후기는 쓸 수 없습니다.",
  fixHint: "후기는 '[예시]'로 시작하고 이름은 '김○○'처럼 가린 자리표시로 두세요.",
  check(ctx) {
    if (!ctx.copy) return [];
    const name = new RegExp(params<{ namePattern: string }>("AIL-22").namePattern, "u");
    const out: LintFinding[] = [];
    for (const c of ctx.copy) {
      if (c.role === "proof.quote") {
        // "인용 — 이름" 한 줄 형식도 받는다
        const [quote = "", who] = norm(c.text).split(/\s+[—–-]\s+/);
        if (!EXAMPLE_PREFIX.test(quote))
          out.push(finding("AIL-22", "error", `후기에 [예시] 접두 없음: "${quote}"`));
        if (who !== undefined && !name.test(who.trim()))
          out.push(finding("AIL-22", "error", `후기 이름 "${who}" 가림 형식 아님`));
      }
      if (c.role === "proof.author" && !name.test(norm(c.text)))
        out.push(finding("AIL-22", "error", `후기 이름 "${c.text}" 가림 형식 아님`));
    }
    return out;
  },
};
