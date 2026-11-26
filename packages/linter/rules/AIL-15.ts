// AIL-15 상투 CTA 반복(04장 4.13.2, C): 상투 CTA 문구가 페이지 합계 ≥ 3회.
import { finding, norm, params } from "../src/lib.js";
import type { Rule } from "../src/types.js";

interface P {
  phrases: string[];
  min: number;
}
export const rule: Rule = {
  id: "AIL-15",
  stage: ["C"],
  severity: ["warn"],
  appliesTo: ["M", "U"],
  messageKo: "'자세히 보기' 같은 상투 CTA가 반복됩니다.",
  fixHint: "버튼마다 행동을 구체적으로 쓰세요(예: '원두 고르기', '매장 위치 보기').",
  check(ctx) {
    if (!ctx.copy) return [];
    const p = params<P>("AIL-15");
    const ph = p.phrases.map((x) => norm(x).toLowerCase());
    let n = 0;
    for (const c of ctx.copy) {
      const t = norm(c.text).toLowerCase();
      for (const x of ph) n += t.split(x).length - 1;
    }
    return n >= p.min ? [finding("AIL-15", "warn", `상투 CTA ${n}회`)] : [];
  },
};
