// AIL-01 보라~파랑 그라디언트(04장 4.13.2). S = 토큰, D = computed background-image.
import { colorsIn, finding, gradients, params } from "../src/lib.js";
import { staticLintImpl } from "../src/stage-s.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  hueA: [number, number];
  hueB: [number, number];
  chromaMin: number;
}
const inR = (h: number, [lo, hi]: [number, number]): boolean => h >= lo && h <= hi;

export const rule: Rule = {
  id: "AIL-01",
  stage: ["S", "D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "보라~파랑 그라디언트는 AI 생성 페이지의 대표 흔적입니다.",
  fixHint: "같은 hue 계열 2-stop 그라디언트나 단색 면으로 바꾸세요.",
  check(ctx) {
    const out: LintFinding[] = [];
    if (ctx.spec && ctx.stages.has("S"))
      out.push(...staticLintImpl(ctx.spec).filter((f) => f.rule === "AIL-01"));
    if (ctx.snapshot) {
      const p = params<P>("AIL-01");
      for (const el of ctx.snapshot.elements)
        for (const g of gradients(el.bgImage)) {
          const cs = colorsIn(g.body).filter((c) => c.c >= p.chromaMin);
          if (cs.some((c) => inR(c.h, p.hueA)) && cs.some((c) => inR(c.h, p.hueB)))
            out.push(finding("AIL-01", "error", `${el.tag} ${g.fn} 보라~파랑 정지점`));
        }
    }
    return out;
  },
};
