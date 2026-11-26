// AIL-02 그라디언트 텍스트(04장 4.13.2, D).
import { finding } from "../src/lib.js";
import type { Rule } from "../src/types.js";

export const rule: Rule = {
  id: "AIL-02",
  stage: ["D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "그라디언트로 칠한 글자는 AI 생성 페이지의 대표 흔적입니다.",
  fixHint: "헤드라인은 단색으로 두고 강조는 크기·굵기로 주세요.",
  check(ctx) {
    if (!ctx.snapshot) return [];
    return ctx.snapshot.elements
      .filter((el) => /\btext\b/.test(el.bgClip) && /gradient\(/.test(el.bgImage))
      .map((el) => finding("AIL-02", "error", `${el.tag} background-clip:text + gradient`));
  },
};
