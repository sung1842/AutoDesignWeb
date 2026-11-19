import { findRepoRoot, loadEnv, withDotenv, type AppEnv } from "@tastefit/config";

let cached: AppEnv | undefined;
/** 서버 런타임 env(검증 완료). 기동 시 check-env가 먼저 통과했으므로 여기서는 예외만 던진다. */
export function serverEnv(): AppEnv {
  cached ??= loadEnv("web", withDotenv(findRepoRoot()));
  return cached;
}
