export const PACKAGE_NAME = "@tastefit/config";
export {
  EnvError,
  loadEnv,
  loadEnvOrExit,
  type AppEnv,
  type EnvIssue,
  type RawEnv,
  type Service,
} from "./env.js";
export {
  E_EXTERNAL_NETWORK,
  ExternalNetworkError,
  installNetworkGuard,
  isLocalHost,
} from "./network-guard.js";
export {
  findRepoRoot,
  getTestPolicy,
  getThresholds,
  thresholdNumber,
  type Json,
  type JsonObject,
} from "./thresholds.js";
export { parseDotenv, withDotenv } from "./dotenv.js";
