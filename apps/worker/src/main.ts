// worker 진입점(09장 9.4.2 ④⑤): env 검증 → pg-boss 기동(migrate) → GET /health 200.
// `--check-env`: env 검증만 하고 종료(AC-06-32).
import { createServer } from "node:http";
import { findRepoRoot, loadEnvOrExit, withDotenv } from "@tastefit/config";
import { randomUUID } from "node:crypto";
import { createDbPort } from "@tastefit/db";
import { PgBoss } from "pg-boss";
import { runGenerationJob, openPipelineHarness } from "./jobs/generation.js";
import { applyKillSwitch } from "./jobs/finish.js";
import { claimNext } from "./jobs/queue.js";

/** health 서버 주소(ASM-001: 고정 포트, env 아님). */
export const WORKER_HEALTH_PORT = 8081;

const env = loadEnvOrExit("worker", withDotenv(findRepoRoot()));
if (process.argv.includes("--check-env")) process.exit(0);

const boss = new PgBoss({ connectionString: env.values.DATABASE_URL_DIRECT, migrate: true });
boss.on("error", (e: unknown) => process.stderr.write(`[worker] pg-boss: ${String(e)}\n`));
await boss.start();

let ready = true;
const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: ready ? "ok" : "stopping" }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(WORKER_HEALTH_PORT, "127.0.0.1", () => {
  process.stdout.write(`[worker] health http://127.0.0.1:${WORKER_HEALTH_PORT}/health\n`);
});

// 생성 잡 소비(ASM-112): 1초마다 킬 스위치 정리 → 슬롯이 있으면 1건 claim → 실행(프로세스당 동시 1)
const db = createDbPort(env.values.DATABASE_URL_DIRECT ?? "");
const workerId = `w-${randomUUID().slice(0, 8)}`;
const harness = await openPipelineHarness();
let busy = false;
const POLL_MS = 1000;
const timer = setInterval(() => {
  if (busy || !ready) return;
  busy = true;
  void (async () => {
    try {
      await applyKillSwitch(db);
      const id = await claimNext(db, workerId);
      if (id) await runGenerationJob({ db, harness }, id, { claimedBy: workerId });
    } catch (e) {
      process.stderr.write(`[worker] loop: ${String((e as Error).stack ?? e)}\n`);
    } finally {
      busy = false;
    }
  })();
}, POLL_MS);

async function shutdown(): Promise<void> {
  ready = false;
  clearInterval(timer);
  await harness.close();
  await db.close();
  server.close();
  await boss.stop({ graceful: true });
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
