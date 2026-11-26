// AIL-12 목적 없는 벤토(04장 4.13.2, T). 항목 유형: number(숫자 포함)·quote(인용부호)·text, 섹션 image 슬롯은 image 1칸(ASM-082).
import { finding, isObj, listItems, params, sections, slotText } from "../src/lib.js";
import type { Rule } from "../src/types.js";

interface P {
  itemsMin: number;
  kindsMin: number;
  plainRatioMax: number;
}
const kindOf = (t: string): string =>
  /\d/.test(t) ? "number" : /^["“「『']/.test(t.trim()) ? "quote" : "text";

export const rule: Rule = {
  id: "AIL-12",
  stage: ["T"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "내용 종류가 섞이지 않은 벤토 그리드는 장식용 격자일 뿐입니다.",
  fixHint: "사진·수치·인용을 섞은 5칸 이상으로 채우거나 단순 리스트로 바꾸세요.",
  check(ctx) {
    const p = params<P>("AIL-12");
    return sections(ctx.tree)
      .filter((s) => s.variant.endsWith(".bento"))
      .flatMap((s) => {
        const texts = listItems(s).map((x) => slotText(x) ?? "");
        const hasImage = Object.values(s.slots).some((v) => isObj(v) && isObj(v.image));
        const kinds = new Set(texts.map(kindOf));
        if (hasImage) kinds.add("image");
        const total = texts.length + (hasImage ? 1 : 0);
        const plain = texts.filter((t) => kindOf(t) !== "number").length;
        const why =
          total < p.itemsMin
            ? `항목 ${total} < ${p.itemsMin}`
            : kinds.size < p.kindsMin
              ? `유형 ${kinds.size}종 < ${p.kindsMin}`
              : total > 0 && plain / total >= p.plainRatioMax
                ? `이미지·수치 없는 항목 ${plain}/${total}`
                : null;
        return why ? [finding("AIL-12", "error", `${s.id} 벤토: ${why}`)] : [];
      });
  },
};
