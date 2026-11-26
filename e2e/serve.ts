// E2E 웹 서버(playwright.config webServer, ASM-100): 전용 DB(tastefit_e2e) 초기화·시드 → 설문 픽스처(전부 active,
// 자산 경로는 manifest.lock = survey:build 산출과 같은 파일) + 닮은 사이트 픽스처 → next build → next start.
// 비밀값은 실행마다 임의 생성(저장소에 쓰지 않음).
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDbPort, q } from "../packages/db/src/index.js";
import { seedSimilarSites, seedSurveyFixture } from "../packages/db/src/testing/fixtures.js";

const ROOT = join(import.meta.dirname, "..");
export const E2E_PORT = 3100;
const DB = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_e2e";
const secret = (): string => randomBytes(32).toString("base64url");
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  APP_ENV: "local",
  STACK_PROFILE: "native",
  AUTH_DRIVER: "local",
  STORAGE_DRIVER: "fs",
  MAIL_DRIVER: "local",
  TURNSTILE_DRIVER: "local",
  LLM_MODE: "mock",
  WEB_ORIGIN: `http://localhost:${E2E_PORT}`,
  PREVIEW_ORIGIN: "http://127.0.0.1:3101",
  DATABASE_URL_DIRECT: DB,
  DATABASE_URL_POOLED: DB,
  LOCAL_JWT_SECRET: secret(),
  PREVIEW_SIGNING_SECRET: secret(),
  IP_HMAC_KEY: secret(),
  CONSENT_HASH_KEY: secret(),
  ADMIN_EMAILS: "admin@example.com",
  NEXT_TELEMETRY_DISABLED: "1",
};
const sh = (cmd: string, args: string[], cwd = ROOT): void => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 실패(${String(r.status)})`);
};

sh("pnpm", ["-s", "db:native", "up"]);
sh("pnpm", ["-s", "db:reset"]);
sh("pnpm", ["-s", "db:seed"]);
const db = createDbPort(DB);
await seedSurveyFixture(db);
await seedSimilarSites(db);
// 자산 경로를 survey:build 산출(manifest.lock)로 바꿔 실제 WebP를 쓴다(파일이 없으면 대체 텍스트 표시, 1.4.2 R1)
const man = join(ROOT, "data/survey/manifest.lock.json");
if (existsSync(man)) {
  const items = (
    JSON.parse(readFileSync(man, "utf8")) as { items: { assetId: string; assets: unknown }[] }
  ).items;
  await db.withService(async (tx) => {
    for (const i of items)
      if (i.assets)
        await q(tx, "update survey_items set assets = $2 where id = $1", [
          i.assetId,
          JSON.stringify(i.assets),
        ]);
  });
}
await db.close();
const web = join(ROOT, "apps/web");
sh("pnpm", ["exec", "next", "build"], web);
const p = spawn("pnpm", ["exec", "next", "start", "-p", String(E2E_PORT)], {
  cwd: web,
  env,
  stdio: "inherit",
});
const stop = (): void => {
  p.kill("SIGTERM");
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
p.on("exit", (c) => process.exit(c ?? 0));
