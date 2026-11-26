// 09장 9.6.2 장애 주입 시나리오 키: scenario | scenario@candidateIndex | scenario@role, 끝 ! = 재호출에도 유지(T-18).
import { LLM_ROLES, LlmError, type LlmRole } from "./gateway.js";

export const MOCK_SCENARIOS = [
  "ok",
  "mixed",
  "invalid_json",
  "schema_violation",
  "forbidden_field",
  "lint_error",
  "low_score",
  "timeout",
  "slow",
  "rate_limit",
  "server_error",
  "injection_echo",
  "cost_spike",
  "cost_ramp",
  "usage_overrun",
  "budget_exhausted",
  "copy_schema_fail",
  "copy_timeout",
  "copy_refusal",
  "judge_position_bias",
] as const;
export type MockScenarioName = (typeof MOCK_SCENARIOS)[number];
/** 정의상 ! 동작(9.6.2 표). */
const ALWAYS_STICKY = new Set<MockScenarioName>(["copy_schema_fail"]);
/** 후보 인덱스 범위(variantIndex × 2 + slotIndex). */
const CANDIDATE_INDEX = /^[0-5]$/;

export type ScenarioScope =
  { kind: "all" } | { kind: "candidate"; index: number } | { kind: "role"; role: LlmRole };
export interface Scenario {
  name: MockScenarioName;
  sticky: boolean;
  scope: ScenarioScope;
}

export function parseScenario(raw: string): Scenario {
  const bad = (why: string): never => {
    throw new LlmError("E_MOCK_SCENARIO", `${JSON.stringify(raw)} ${why}`);
  };
  const m = /^([a-z_]+)(!?)(?:@(.+))?$/.exec(raw);
  if (!m?.[1]) return bad("형식 아님");
  const name = m[1] as MockScenarioName;
  if (!(MOCK_SCENARIOS as readonly string[]).includes(name)) return bad("모르는 시나리오");
  const at = m[3];
  let scope: ScenarioScope = { kind: "all" };
  if (at !== undefined && at !== "*") {
    if (CANDIDATE_INDEX.test(at)) scope = { kind: "candidate", index: Number(at) };
    else if ((LLM_ROLES as readonly string[]).includes(at))
      scope = { kind: "role", role: at as LlmRole };
    else return bad("범위는 0~5·역할·* 중 하나");
  }
  return { name, sticky: m[2] === "!" || ALWAYS_STICKY.has(name), scope };
}

/** 이 호출에 장애가 적용되는가: 범위 일치 ∧ (initial ∨ sticky). */
export function scenarioApplies(
  s: Scenario,
  c: { role: LlmRole; candidateIndex: number | null; callKind: string },
): boolean {
  if (s.name === "ok") return false;
  const inScope =
    s.scope.kind === "all" ||
    (s.scope.kind === "candidate" && c.candidateIndex === s.scope.index) ||
    (s.scope.kind === "role" && c.role === s.scope.role);
  return inScope && (c.callKind === "initial" || s.sticky);
}
