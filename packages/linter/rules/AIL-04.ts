// AIL-04 중앙 히어로 + 배지(04장 4.13.2, T·C). eyebrow pill = 카피 style "pill" 또는 spec radius_family pill(태그 999, 3.1.7).
import { finding, isObj, l2Of, params, sections, slotText, variantMeta } from "../src/lib.js";
import type { Rule } from "../src/types.js";

interface P {
  textPattern: string;
  flags: string;
}
export const rule: Rule = {
  id: "AIL-04",
  stage: ["T", "C"],
  severity: ["error"],
  appliesTo: ["M"],
  messageKo: "가운데 정렬 히어로 위의 '신규·NEW' 배지는 전형적인 AI 랜딩 패턴입니다.",
  fixHint: "히어로를 좌측 정렬로 바꾸거나 eyebrow에 브랜드 고유 정보(지역·업종)를 쓰세요.",
  check(ctx) {
    const hero = sections(ctx.tree).find((s) => s.block === "hero");
    if (!hero || variantMeta(hero.variant)?.align !== "center") return [];
    const copyEyebrow = (ctx.copy ?? []).find((c) => c.role === "hero.eyebrow");
    const text = copyEyebrow?.text ?? slotText(hero.slots.eyebrow) ?? "";
    const slotStyle = isObj(hero.slots.eyebrow) ? hero.slots.eyebrow.style : undefined;
    const pill =
      copyEyebrow?.style === "pill" ||
      slotStyle === "pill" ||
      l2Of(ctx.spec, "shape.radius_family") === "pill";
    const p = params<P>("AIL-04");
    if (pill && new RegExp(p.textPattern, p.flags).test(text))
      return [finding("AIL-04", "error", `중앙 hero(${hero.variant}) + pill 배지 "${text}"`)];
    return [];
  },
};
