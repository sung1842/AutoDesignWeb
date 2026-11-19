// 04장 4.10.2 하드 게이트 선구현(9.4.4 ②, ASM-025 ②). M2-09에서 채운다.
export interface GateResult {
  id: string;
  pass: boolean;
  violations: string[];
}
export function evaluateGates(_measure: unknown, _ids: string[]): GateResult[] {
  void [_measure, _ids];
  throw new Error("evaluateGates: M2-09에서 구현 예정");
}
export function harmonyScore(_spec: unknown, _tree: unknown): { total: number } {
  void [_spec, _tree];
  throw new Error("harmonyScore: M2-09에서 구현 예정");
}
