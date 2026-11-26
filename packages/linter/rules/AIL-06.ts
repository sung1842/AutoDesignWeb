// AIL-06 균일 rounded + 흐린 그림자(04장 4.13.2, S·D). allowSoftRoundShadow 프리셋(T3·T4·T6)은 warn.
import { finding, params, parseShadows } from "../src/lib.js";
import { staticLintImpl } from "../src/stage-s.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  radiusPx: [number, number];
  blurMinPx: number;
  alphaMax: number;
  warnTypes: string[];
  cardRatioMin: number;
}

export const rule: Rule = {
  id: "AIL-06",
  stage: ["S", "D"],
  severity: ["error", "warn"],
  appliesTo: ["M", "U"],
  messageKo: "모든 카드가 같은 둥근 모서리와 흐린 그림자면 기본 템플릿처럼 보입니다.",
  fixHint: "radius를 줄이고 그림자 대신 hairline 테두리나 면 대비로 구분하세요.",
  check(ctx) {
    const out: LintFinding[] = [];
    if (ctx.spec && ctx.stages.has("S"))
      out.push(...staticLintImpl(ctx.spec).filter((f) => f.rule === "AIL-06"));
    if (!ctx.snapshot) return out;
    const p = params<P>("AIL-06");
    const cards = ctx.snapshot.elements.filter((e) => e.card);
    if (cards.length === 0) return out;
    const soft = cards.filter((e) => {
      const sh = parseShadows(e.boxShadow).filter((s) => !s.inset);
      return (
        e.radius >= p.radiusPx[0] &&
        e.radius <= p.radiusPx[1] &&
        sh.length > 0 &&
        Math.max(...sh.map((s) => s.blur)) >= p.blurMinPx &&
        sh.every((s) => (s.color?.alpha ?? 1) <= p.alphaMax)
      );
    });
    if (soft.length / cards.length >= p.cardRatioMin) {
      const typeId = ctx.spec && typeof ctx.spec.type_id === "string" ? ctx.spec.type_id : "";
      const sev = p.warnTypes.includes(typeId) ? "warn" : "error";
      out.push(finding("AIL-06", sev, `카드 ${soft.length}/${cards.length} rounded+흐린 그림자`));
    }
    return out;
  },
};
