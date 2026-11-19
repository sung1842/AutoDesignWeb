// pnpm db:grants-snapshot (06장 6.3.5 권한 스냅샷, T-11): anon·authenticated의 INSERT·UPDATE·DELETE 정책·테이블 권한·컬럼 권한을
//   카탈로그(relacl·attacl, information_schema는 service_role에 일부만 보임)에서 덤프해 packages/db/grants.snapshot.json(6.3.5 표가 원천, 손으로 관리)과 비교한다. 허용 목록 밖 항목이 하나라도 있으면 종료 1.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDotenv } from "../../packages/config/src/dotenv.js";
import { createDbPort, q } from "../../packages/db/src/index.js";

export const SNAPSHOT = "packages/db/grants.snapshot.json";
const ROLES = ["anon", "authenticated"];
const WRITE = ["INSERT", "UPDATE", "DELETE"];

export async function dumpGrants(url: string): Promise<string[]> {
  const db = createDbPort(url);
  try {
    return await db.withService(async (tx) => {
      const out: string[] = [];
      for (const r of (
        await q(
          tx,
          `select policyname, tablename, cmd, roles::text[] as roles from pg_policies
           where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')`,
        )
      ).rows)
        for (const role of r.roles as string[])
          if (ROLES.includes(role) || role === "public")
            out.push(
              `policy ${String(r.cmd)} ${String(r.tablename)} ${String(r.policyname)} ${role}`,
            );
      for (const r of (
        await q(
          tx,
          `select r.rolname as grantee, c.relname as table_name, x.privilege_type
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           cross join lateral aclexplode(c.relacl) x join pg_roles r on r.oid = x.grantee
           where n.nspname = 'public' and c.relkind in ('r','v','p') and r.rolname = any($1) and x.privilege_type = any($2)`,
          [ROLES, WRITE],
        )
      ).rows)
        out.push(`table ${String(r.privilege_type)} ${String(r.table_name)} ${String(r.grantee)}`);
      for (const r of (
        await q(
          tx,
          `select r.rolname as grantee, c.relname as table_name, a.attname as column_name, x.privilege_type
           from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
           cross join lateral aclexplode(a.attacl) x join pg_roles r on r.oid = x.grantee
           where n.nspname = 'public' and a.attacl is not null and r.rolname = any($1) and x.privilege_type = any($2)`,
          [ROLES, WRITE],
        )
      ).rows)
        out.push(
          `column ${String(r.privilege_type)} ${String(r.table_name)}.${String(r.column_name)} ${String(r.grantee)}`,
        );
      return [...new Set(out)].sort();
    });
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const url = withDotenv(root).DATABASE_URL_DIRECT;
  if (!url) {
    process.stderr.write("db:grants-snapshot: DATABASE_URL_DIRECT 없음\n");
    process.exit(1);
  }
  const want = (JSON.parse(readFileSync(join(root, SNAPSHOT), "utf8")) as { allowed: string[] })
    .allowed;
  dumpGrants(url).then(
    (got) => {
      const extra = got.filter((g) => !want.includes(g));
      const missing = want.filter((w) => !got.includes(w));
      for (const e of extra) process.stdout.write(`허용 목록 밖: ${e}\n`);
      for (const m of missing) process.stdout.write(`스냅샷에만 있음: ${m}\n`);
      process.stdout.write(`db:grants-snapshot: 밖 ${extra.length} · 누락 ${missing.length}\n`);
      process.exit(extra.length + missing.length === 0 ? 0 : 1);
    },
    (e: unknown) => {
      process.stderr.write(`db:grants-snapshot 실패: ${(e as Error).message}\n`);
      process.exit(1);
    },
  );
}
