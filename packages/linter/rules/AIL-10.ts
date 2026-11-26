// AIL-10 이모지 아이콘(04장 4.13.2, C·D). 헤딩·버튼·배지·카드 제목 ≥ 1 = error, 본문 합계 ≥ 2 = warn.
import { emojiCount, finding, isHeadingRole, params } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  headingMin: number;
  bodyWarnMin: number;
}
function judge(items: { strong: boolean; text: string }[], p: P, where: string): LintFinding[] {
  const out: LintFinding[] = [];
  let body = 0;
  for (const it of items) {
    const n = emojiCount(it.text);
    if (it.strong && n >= p.headingMin)
      out.push(finding("AIL-10", "error", `${where} 제목류 이모지 "${it.text}"`));
    else if (!it.strong) body += n;
  }
  if (body >= p.bodyWarnMin) out.push(finding("AIL-10", "warn", `${where} 본문 이모지 ${body}개`));
  return out;
}

export const rule: Rule = {
  id: "AIL-10",
  stage: ["C", "D"],
  severity: ["error", "warn"],
  appliesTo: ["M", "U"],
  messageKo: "제목·버튼의 이모지 아이콘은 AI 생성 카피의 흔적입니다.",
  fixHint: "이모지를 빼고 필요하면 인라인 SVG 아이콘을 쓰세요.",
  check(ctx) {
    const p = params<P>("AIL-10");
    const out: LintFinding[] = [];
    if (ctx.copy)
      out.push(
        ...judge(
          ctx.copy.map((c) => ({ strong: isHeadingRole(c.role), text: c.text })),
          p,
          "카피",
        ),
      );
    if (ctx.snapshot)
      out.push(
        ...judge(
          ctx.snapshot.elements
            .filter((e) => e.text)
            .map((e) => ({
              strong: e.heading || e.button || e.badge || e.cardTitle,
              text: e.text,
            })),
          p,
          "렌더",
        ),
      );
    return out;
  },
};
