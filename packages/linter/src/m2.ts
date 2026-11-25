// 04장 4.13 린터 단계 S·T 최소 구현(ASM-024 ⑤, ASM-025 ⑥). M2-08에서 채운다.
import { staticLintImpl, type LintFinding } from "./stage-s.js";
export type { LintFinding };
/** 단계 S(ASM-038). */
export function staticLint(spec: unknown): LintFinding[] {
  return staticLintImpl(spec);
}
export function treeLint(_spec: unknown, _tree: unknown): LintFinding[] {
  void [_spec, _tree];
  throw new Error("treeLint: M2-08에서 구현 예정");
}
