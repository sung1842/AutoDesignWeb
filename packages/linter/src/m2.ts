// 04장 4.13 린터 단계 S·T 최소 구현(ASM-024 ⑤, ASM-025 ⑥). M2-08에서 채운다.
import { staticLintImpl, type LintFinding } from "./stage-s.js";
import { treeLintImpl } from "./stage-t.js";
export type { LintFinding };
/** 단계 S(ASM-038). */
export function staticLint(spec: unknown): LintFinding[] {
  return staticLintImpl(spec);
}
/** 단계 T(ASM-073). */
export function treeLint(spec: unknown, tree: unknown): LintFinding[] {
  return treeLintImpl(spec, tree);
}
