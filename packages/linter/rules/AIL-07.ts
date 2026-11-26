// AIL-07 동일 섹션 리듬(04장 4.13.2, T). (a) 인접 동일 variant·(b) pad 전부 동일 = error, (c)(d)(e) = warn.
import { finding, params, sections, variantMeta } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  sameBgRun: number;
  strictAltMinSections: number;
  centeredRatioMax: number;
  minSections: number;
}
export const rule: Rule = {
  id: "AIL-07",
  stage: ["T"],
  severity: ["error", "warn"],
  appliesTo: ["M"],
  messageKo: "섹션 리듬이 단조로우면 자동 생성 페이지처럼 보입니다.",
  fixHint: "섹션 하나의 pad를 키우고 inverse 섹션을 넣어 리듬을 만드세요.",
  check(ctx) {
    const secs = sections(ctx.tree);
    const p = params<P>("AIL-07");
    if (secs.length < p.minSections) return [];
    const out: LintFinding[] = [];
    for (let i = 1; i < secs.length; i++)
      if (secs[i]?.variant === secs[i - 1]?.variant)
        out.push(finding("AIL-07", "error", `(a) 인접 같은 variant ${secs[i]?.variant}`));
    if (secs.every((s) => s.pad === secs[0]?.pad))
      out.push(finding("AIL-07", "error", `(b) 모든 섹션 pad ${secs[0]?.pad}`));
    let run = 1;
    for (let i = 1; i < secs.length; i++) {
      run = secs[i]?.bg === secs[i - 1]?.bg ? run + 1 : 1;
      if (run === p.sameBgRun) out.push(finding("AIL-07", "warn", `(c) bg ${secs[i]?.bg} 연속`));
    }
    const bgs = secs.map((s) => s.bg);
    if (
      secs.length >= p.strictAltMinSections &&
      bgs.every((b, i) => i === 0 || b !== bgs[i - 1]) &&
      new Set(bgs).size === 2
    )
      out.push(finding("AIL-07", "warn", "(d) bg 엄격 교대"));
    const centered = secs.filter((s) => variantMeta(s.variant)?.align === "center").length;
    if (centered / secs.length > p.centeredRatioMax)
      out.push(finding("AIL-07", "warn", `(e) 중앙 정렬 ${centered}/${secs.length}`));
    return out;
  },
};
