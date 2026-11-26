// LLM gateway(09장 9.6.1, 07장 7.1.3). 모드 선택은 이 파일의 createGateway 한 곳에서만 한다.
//   mock   : MockProvider(09장 9.6.2) — 역할별 결정적 합성은 M5 산출물. 지금은 E_MOCK_UNAVAILABLE.
//   replay : fixtures/llm/<role>/<requestHash>.json 반환, 없으면 E_REPLAY_MISS(실호출로 대체하지 않음).
//            SHA-256(정규화 JSON output) ≠ outputSha256이면 E_REPLAY_TAMPERED(수동 편집 탐지).
//   record·live : 실제 provider 호출. MVP 구현 전이며 키 없는 환경에서는 E_LIVE_DISABLED.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const LLM_ROLES = ["gen_layout", "gen_copy", "judge_vision", "ref_tagger"] as const;
export type LlmRole = (typeof LLM_ROLES)[number];
export const LLM_MODES = ["mock", "replay", "record", "live"] as const;
export type LlmMode = (typeof LLM_MODES)[number];

export type LlmErrorCode =
  | "E_REPLAY_MISS"
  | "E_REPLAY_TAMPERED"
  | "E_MOCK_UNAVAILABLE"
  | "E_LIVE_DISABLED"
  | "E_LLM_ROLE"
  | "E_LLM_MODE"
  | "E_MOCK_SCENARIO"
  | "E_MODELS_INVALID";

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "LlmError";
  }
}

export interface LlmRequest {
  role: string;
  promptVersion: number;
  input: unknown;
}

export interface LlmResponse {
  role: LlmRole;
  promptVersion: string;
  requestHash: string;
  output: unknown;
  source: LlmMode;
}

export interface Gateway {
  readonly mode: LlmMode;
  invoke(req: LlmRequest): Promise<LlmResponse>;
}

/** 정규화 JSON: 키 정렬, 공백 제거(9.6.1). */
export function normalizeJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(normalizeJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${normalizeJson(o[k])}`)
    .join(",")}}`;
}

export const promptVersionId = (role: LlmRole, n: number): string => `${role}@v${n}`;

/** requestHash = SHA-256(role + promptVersion + 정규화 JSON 입력). */
export function requestHash(role: LlmRole, promptVersion: string, input: unknown): string {
  return createHash("sha256")
    .update(role + promptVersion + normalizeJson(input))
    .digest("hex");
}

function asRole(r: string): LlmRole {
  if ((LLM_ROLES as readonly string[]).includes(r)) return r as LlmRole;
  throw new LlmError("E_LLM_ROLE", `알 수 없는 역할 ${r}`);
}

export function parseMode(v: string | undefined): LlmMode {
  const m = v ?? "mock";
  if ((LLM_MODES as readonly string[]).includes(m)) return m as LlmMode;
  throw new LlmError("E_LLM_MODE", `알 수 없는 LLM_MODE ${m}`);
}

interface Fixture {
  requestHash: string;
  role: string;
  promptVersion: string;
  output: unknown;
  outputSha256: string;
}

export function createGateway(
  env: Readonly<Record<string, string | undefined>>,
  opts: { fixturesDir?: string } = {},
): Gateway {
  const mode = parseMode(env.LLM_MODE);
  const fixturesDir = opts.fixturesDir ?? "fixtures/llm";
  return {
    mode,
    invoke(req: LlmRequest): Promise<LlmResponse> {
      try {
        const role = asRole(req.role);
        const pv = promptVersionId(role, req.promptVersion);
        const hash = requestHash(role, pv, req.input);
        if (mode === "replay") {
          const p = join(fixturesDir, role, `${hash}.json`);
          if (!existsSync(p)) throw new LlmError("E_REPLAY_MISS", `${role}/${hash}.json 없음`);
          const fx = JSON.parse(readFileSync(p, "utf8")) as Fixture;
          const sha = createHash("sha256").update(normalizeJson(fx.output)).digest("hex");
          if (sha !== fx.outputSha256)
            throw new LlmError("E_REPLAY_TAMPERED", `${role}/${hash}.json output 해시 불일치`);
          return Promise.resolve({
            role,
            promptVersion: pv,
            requestHash: hash,
            output: fx.output,
            source: "replay",
          });
        }
        if (mode === "mock")
          throw new LlmError("E_MOCK_UNAVAILABLE", "MockProvider는 M5에서 구현(09장 9.6.2)");
        throw new LlmError("E_LIVE_DISABLED", `${mode} 모드는 키·provider 구현 전(사람 실행 전용)`);
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
  };
}
