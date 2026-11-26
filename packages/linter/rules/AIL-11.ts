// AIL-11 네온 글로우(04장 4.13.2, D): text/box-shadow blur ≥ 12px ∧ C ≥ 0.15 ∧ offset 0.
import { finding, params, parseShadows } from "../src/lib.js";
import type { Rule } from "../src/types.js";

interface P {
  blurMinPx: number;
  chromaMin: number;
}
export const rule: Rule = {
  id: "AIL-11",
  stage: ["D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "형광색 글로우 그림자는 AI 랜딩의 상투 효과입니다.",
  fixHint: "글로우를 빼거나 offset이 있는 단단한 그림자(blur 0)로 바꾸세요.",
  check(ctx) {
    if (!ctx.snapshot) return [];
    const p = params<P>("AIL-11");
    return ctx.snapshot.elements
      .filter((e) =>
        [...parseShadows(e.boxShadow), ...parseShadows(e.textShadow)].some(
          (s) =>
            s.x === 0 &&
            s.y === 0 &&
            s.blur >= p.blurMinPx &&
            (s.color?.c ?? 0) >= p.chromaMin &&
            (s.color?.alpha ?? 0) > 0,
        ),
      )
      .map((e) => finding("AIL-11", "error", `${e.tag} 네온 글로우`));
  },
};
