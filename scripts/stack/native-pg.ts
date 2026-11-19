// native 프로파일 PostgreSQL 16(06장 6.13.1): initdb → /tmp/tastefit-pg(:54322) → 기동 → shim 적용.
// 사용: tsx scripts/stack/native-pg.ts up|down|status|reset
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export const PG_DIR = "/tmp/tastefit-pg";
export const PG_PORT = "54322";
export const PG_DB = "tastefit";
const SHIM = "packages/db/shim/0000_supabase_shim.sql";

function pgBin(name: string): string {
  const base = "/usr/lib/postgresql";
  if (existsSync(base)) {
    const vers = readdirSync(base).sort().reverse();
    for (const v of vers) {
      const p = join(base, v, "bin", name);
      if (existsSync(p)) return p;
    }
  }
  return name;
}

/** postgres는 root로 못 돈다. root면 postgres 사용자로 실행한다. */
function asPg(cmd: string, args: string[], input?: string): string {
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const [file, argv] = isRoot ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args];
  const r = spawnSync(file, argv, { encoding: "utf8", input, cwd: "/tmp" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 실패: ${r.stderr || r.stdout}`);
  return r.stdout;
}

const psql = (sql: string, db = "postgres"): string =>
  asPg(pgBin("psql"), [
    "-h",
    PG_DIR,
    "-p",
    PG_PORT,
    "-d",
    db,
    "-v",
    "ON_ERROR_STOP=1",
    "-qAt",
    "-c",
    sql,
  ]);

export function isRunning(): boolean {
  const r = spawnSync(pgBin("pg_isready"), ["-h", PG_DIR, "-p", PG_PORT], { encoding: "utf8" });
  return r.status === 0;
}

export function up(root = process.cwd()): void {
  if (!existsSync(join(PG_DIR, "PG_VERSION"))) {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      execFileSync("install", ["-d", "-o", "postgres", "-g", "postgres", "-m", "0700", PG_DIR]);
    }
    asPg(pgBin("initdb"), [
      "-D",
      PG_DIR,
      "-U",
      "postgres",
      "--auth=trust",
      "-E",
      "UTF8",
      "--locale=C.UTF-8",
    ]);
  }
  if (!isRunning()) {
    const opts = `-p ${PG_PORT} -k ${PG_DIR} -c listen_addresses=127.0.0.1`;
    asPg(pgBin("pg_ctl"), [
      "-D",
      PG_DIR,
      "-o",
      opts,
      "-l",
      join(PG_DIR, "server.log"),
      "-w",
      "-t",
      "60",
      "start",
    ]);
  }
  if (psql(`SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'`).trim() !== "1")
    psql(`CREATE DATABASE ${PG_DB}`);
  asPg(pgBin("psql"), [
    "-h",
    PG_DIR,
    "-p",
    PG_PORT,
    "-d",
    PG_DB,
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    "-f",
    join(root, SHIM),
  ]);
  psql(
    `GRANT CONNECT, CREATE ON DATABASE ${PG_DB} TO tastefit_app; GRANT USAGE ON SCHEMA public TO tastefit_app`,
    PG_DB,
  );
}

export const MIGRATIONS_DIR = "packages/db/supabase/migrations";
export const LOCAL_DIR = "packages/db/supabase/local";

/** 적용 순서: shim → migrations(파일명 순) → (APP_ENV=local이면) local 전용(S-01). */
export function migrationFiles(root: string, local: boolean): string[] {
  const list = (d: string): string[] =>
    existsSync(join(root, d))
      ? readdirSync(join(root, d))
          .filter((f) => f.endsWith(".sql"))
          .sort()
          .map((f) => join(root, d, f))
      : [];
  return [join(root, SHIM), ...list(MIGRATIONS_DIR), ...(local ? list(LOCAL_DIR) : [])];
}

/** 빈 DB(drop/create) 위에 shim+마이그레이션을 ON_ERROR_STOP으로 적용(06장 AC-06-01, 9.4.3 ⑤). */
export function resetDb(root: string, db: string, local: boolean): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(db)) throw new Error(`DB 이름 형식 아님: ${db}`);
  up(root);
  psql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  psql(`CREATE DATABASE ${db}`);
  const files = migrationFiles(root, local).flatMap((f) => ["-f", f]);
  asPg(pgBin("psql"), [
    "-h",
    PG_DIR,
    "-p",
    PG_PORT,
    "-d",
    db,
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    ...files,
  ]);
  psql(
    `GRANT CONNECT, CREATE ON DATABASE ${db} TO tastefit_app; GRANT USAGE ON SCHEMA public TO tastefit_app`,
    db,
  );
}

/** DATABASE_URL_DIRECT의 DB 이름(없으면 기본 tastefit). */
export function dbNameFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL_DIRECT;
  if (!url) return PG_DB;
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, "")) || PG_DB;
}

export function down(): void {
  if (isRunning()) asPg(pgBin("pg_ctl"), ["-D", PG_DIR, "-m", "fast", "-w", "stop"]);
}

export function reset(root = process.cwd()): void {
  down();
  rmSync(PG_DIR, { recursive: true, force: true });
  up(root);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] ?? "status";
  if (cmd === "up") up();
  else if (cmd === "down") down();
  else if (cmd === "reset") reset();
  else if (cmd === "db-reset") {
    const db = dbNameFromEnv();
    resetDb(process.cwd(), db, (process.env.APP_ENV ?? "local") === "local");
    process.stdout.write(`db:reset: ${db} 적용 완료\n`);
  }
  process.stdout.write(
    `native-pg: ${isRunning() ? "running" : "stopped"} (${PG_DIR}:${PG_PORT}/${PG_DB})\n`,
  );
}
