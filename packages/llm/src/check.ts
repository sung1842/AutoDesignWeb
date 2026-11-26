// pnpm llm:check — 기동 검사(06장 6.9.2·08장 8.8.2, AC-06-22, ASM-107 ⑤). 외부 요청 0.
//   models.yaml zod 검증 → LLM_MODE ∈ {live, record}면 승인 공급자 검사. 위반 시 종료 코드 1.
import { parseMode } from "./gateway.js";
import { assertLiveReady, loadModels } from "./models.js";
import { parseScenario } from "./scenario.js";

try {
  const mode = parseMode(process.env.LLM_MODE);
  const m = loadModels(process.env.MODELS_PATH || undefined);
  if (mode === "live" || mode === "record") assertLiveReady(m);
  if (mode === "mock") parseScenario(process.env.MOCK_LLM_SCENARIO ?? "ok");
  process.stdout.write(`llm:check ok (mode=${mode}, revision=${m.revision})\n`);
} catch (e) {
  process.stderr.write(`llm:check 실패: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
