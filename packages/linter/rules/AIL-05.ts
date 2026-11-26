// AIL-05 3열 아이콘 카드(04장 4.13.2, T·D). 페이지 1회 warn, 2회 이상 error.
import { finding, listItems, params, sections, variantMeta } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  cards: number;
  widthSpreadMax: number;
  errorFrom: number;
}
const verdict = (n: number, p: P, where: string): LintFinding[] =>
  n === 0
    ? []
    : [
        finding(
          "AIL-05",
          n >= p.errorFrom ? "error" : "warn",
          `아이콘 카드 ${p.cards}열 ${n}회(${where})`,
        ),
      ];

export const rule: Rule = {
  id: "AIL-05",
  stage: ["T", "D"],
  severity: ["warn", "error"],
  appliesTo: ["M", "U"],
  messageKo: "아이콘+제목+본문 카드 3열은 AI 랜딩의 상투 구성입니다.",
  fixHint: "번호형 리스트(01/02/03), 분할 레이아웃, 사진 카드 등으로 바꾸세요.",
  check(ctx) {
    const p = params<P>("AIL-05");
    const out: LintFinding[] = [];
    if (ctx.tree) {
      const n = sections(ctx.tree).filter(
        (s) => variantMeta(s.variant)?.icon_grid === true && listItems(s).length === p.cards,
      ).length;
      out.push(...verdict(n, p, "트리"));
    }
    if (ctx.snapshot) {
      const secs = new Set(
        ctx.snapshot.iconCardRows
          .filter((r) => r.n === p.cards && r.widthSpread <= p.widthSpreadMax)
          .map((r) => r.section),
      );
      out.push(...verdict(secs.size, p, "렌더"));
    }
    return out;
  },
};
