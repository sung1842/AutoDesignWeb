export const PACKAGE_NAME = "@tastefit/llm";
export {
  LLM_MODES,
  LLM_ROLES,
  LlmError,
  createGateway,
  normalizeJson,
  parseMode,
  promptVersionId,
  requestHash,
  type Gateway,
  type LlmErrorCode,
  type LlmMode,
  type LlmRequest,
  type LlmResponse,
  type LlmRole,
} from "./gateway.js";
export { assemblePrompt, type AssembledPrompt, type PromptInput } from "./prompt.js";
export {
  ModelsSchema,
  UnapprovedProcessorError,
  assertLiveReady,
  checkModelsCompliance,
  defaultModelsPath,
  loadModels,
  loadProcessors,
  processorProblem,
  type ModelEntry,
  type Models,
} from "./models.js";
export {
  MOCK_SCENARIOS,
  parseScenario,
  scenarioApplies,
  type MockScenarioName,
  type Scenario,
  type ScenarioScope,
} from "./scenario.js";
export {
  createMockProvider,
  mockSeed,
  type CacheState,
  type CallKind,
  type MockCall,
  type MockProvider,
  type MockResult,
  type MockUsage,
  type Sleep,
} from "./mock.js";
