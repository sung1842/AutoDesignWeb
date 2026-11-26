// AIL-08 컬러 블롭(04장 4.13.2, D): absolute/fixed 장식에 blur(≥40px) 또는 큰 radial-gradient.
import { blurPx, finding, gradients, params } from "../src/lib.js";
import type { Rule } from "../src/types.js";

interface P {
  blurMinPx: number;
  areaRatioMin: number;
}
export const rule: Rule = {
  id: "AIL-08",
  stage: ["D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "배경에 흐린 색 덩어리(블롭)는 AI 랜딩의 대표 장식입니다.",
  fixHint: "장식을 없애거나 grain·선 같은 프리셋 장식으로 바꾸세요.",
  check(ctx) {
    const s = ctx.snapshot;
    if (!s) return [];
    const p = params<P>("AIL-08");
    const view = s.vw * s.vh;
    return s.elements
      .filter((e) => e.position === "absolute" || e.position === "fixed")
      .filter((e) => e.decorative)
      .filter(
        (e) =>
          blurPx(e.filter) >= p.blurMinPx ||
          (gradients(e.bgImage).some((g) => g.fn.includes("radial")) &&
            (e.w * e.h) / view >= p.areaRatioMin),
      )
      .map((e) => finding("AIL-08", "error", `${e.tag} 블롭(${e.position}, ${e.filter})`));
  },
};
