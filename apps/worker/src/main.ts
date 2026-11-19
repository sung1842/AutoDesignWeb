// worker 진입점(09장 9.4.2 ④⑤): env 검증 → pg-boss 기동(migrate) → GET /health 200.
// `--check-env`: env 검증만 하고 종료(AC-06-32).
import { createServer } from "node:http";
import { findRepoRoot, loadEnvOrExit, withDotenv } from "@tastefit/config";
import { PgBoss } from "pg-boss";

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

async function shutdown(): Promise<void> {
  ready = false;
  server.close();
  await boss.stop({ graceful: true });
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
