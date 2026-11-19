// 04장 4.13 린터 단계 S·T 최소 구현(ASM-024 ⑤, ASM-025 ⑥). M2-08에서 채운다.
export interface LintFinding {
  rule: string;
  severity: "error" | "warn";
  message: string;
}
export function staticLint(_spec: unknown): LintFinding[] {
  void [_spec];
  throw new Error("staticLint: M2-08에서 구현 예정");
}
export function treeLint(_spec: unknown, _tree: unknown): LintFinding[] {
  void [_spec, _tree];
  throw new Error("treeLint: M2-08에서 구현 예정");
}
