// AIL-09 의미 없는 글래스(04장 4.13.2). S = backdrop 장식 ∧ depth.style ≠ glass, P = 뒤 영역 휘도 표준편차 < 4.
import { finding, params } from "../src/lib.js";
import { staticLintImpl } from "../src/stage-s.js";
import type { LintFinding, Rule } from "../src/types.js";

export const rule: Rule = {
  id: "AIL-09",
  stage: ["S", "P"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "단색 배경 위 반투명 글래스는 의미 없는 장식입니다.",
  fixHint: "글래스는 사진·패턴 위 내비처럼 뒤가 보일 때만 쓰고, 아니면 불투명 면으로 바꾸세요.",
  check(ctx) {
    const out: LintFinding[] = [];
    if (ctx.spec && ctx.stages.has("S")) out.push(...staticLintImpl(ctx.spec).filter((f) => f.rule === "AIL-09"));
    if (ctx.snapshot) {
      const max = params<{ lumStdMax: number }>("AIL-09P").lumStdMax;
      for (const g of ctx.snapshot.glass)
        if (g.lumStd < max)
          out.push(finding("AIL-09", "error", `글래스 뒤 휘도 표준편차 ${g.lumStd.toFixed(2)}`));
    }
    return out;
  },
};
