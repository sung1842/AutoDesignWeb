// AIL-19 권유형 종결 반복(04장 4.13.2, C): "~해 보세요/해보세요" 종결 페이지당 ≥ 3.
import { finding, params, sentences } from "../src/lib.js";
import type { Rule } from "../src/types.js";

const END = /해\s?보세요[.!?…~]*$/u;
export const rule: Rule = {
  id: "AIL-19",
  stage: ["C"],
  severity: ["warn"],
  appliesTo: ["M", "U"],
  messageKo: "'~해 보세요'로 끝나는 권유형 문장이 반복됩니다.",
  fixHint: "평서·명사형 종결을 섞어 문장 끝을 다양하게 바꾸세요.",
  check(ctx) {
    if (!ctx.copy) return [];
    const n = ctx.copy.flatMap((c) => sentences(c.text)).filter((s) => END.test(s)).length;
    return n >= params<{ min: number }>("AIL-19").min
      ? [finding("AIL-19", "warn", `권유형 종결 ${n}회`)]
      : [];
  },
};
