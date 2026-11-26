// pnpm db:types (06장 T-11, 09장 9.4.3 ⑧): kysely-codegen(DATABASE_URL_DIRECT) → packages/db/src/types.gen.ts.
//   public 스키마만, local 전용 테이블(9000_local_only)은 제외해 프로파일·APP_ENV와 무관한 타입을 만든다(AD-030).
//   결과를 prettier로 정렬해 커밋본과 바이트 비교가 가능하게 한다.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { withDotenv } from "../../packages/config/src/dotenv.js";

export const OUT = "packages/db/src/types.gen.ts";

function sh(cmd: string, args: string[], env: NodeJS.ProcessEnv): void {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const root = process.cwd();
const env = withDotenv(root);
if (!env.DATABASE_URL_DIRECT) {
  process.stderr.write("db:types: DATABASE_URL_DIRECT 없음\n");
  process.exit(1);
}
const merged: NodeJS.ProcessEnv = { ...process.env, ...env };
sh(
  join(root, "packages/db/node_modules/.bin/kysely-codegen"),
  [
    "--dialect",
    "postgres",
    "--url",
    "env(DATABASE_URL_DIRECT)",
    "--include-pattern",
    "public.*",
    "--exclude-pattern",
    "public.dev_mail_outbox",
    "--out-file",
    join(root, OUT),
  ],
  merged,
);
sh(
  join(root, "node_modules/.bin/prettier"),
  ["--write", "--log-level", "warn", join(root, OUT)],
  merged,
);
