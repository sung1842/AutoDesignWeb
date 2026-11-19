// 스키마 대조(09장 9.4.3 ⑨): FINAL 06장 6.3.3 DDL 블록의 create table 목록을 파싱해 information_schema·pg_constraint와 비교한다.
//   비교: 테이블 집합, 테이블별 컬럼(이름·정규화 타입·NOT NULL), 제약 수(PK·FK·UNIQUE·CHECK). 차이 0이면 종료 0.
//   9000_local_only 테이블은 APP_ENV=local일 때만 기대한다. 패키지 스크립트 이름은 BLK-006 참고(db:schema-parity).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withDotenv } from "../../packages/config/src/dotenv.js";
import { createDbPort, q } from "../../packages/db/src/index.js";

export interface ColSpec {
  name: string;
  type: string;
  notNull: boolean;
}
export interface TableSpec {
  name: string;
  localOnly: boolean;
  cols: ColSpec[];
  cons: { p: number; f: number; u: number; c: number };
}

const TYPE_MAP: [RegExp, string][] = [
  [/^timestamptz$/, "timestamp with time zone"],
  [/^timestamp$/, "timestamp without time zone"],
  [/^(int|integer|int4|serial)$/, "integer"],
  [/^(bigint|int8|bigserial)$/, "bigint"],
  [/^(smallint|int2)$/, "smallint"],
  [/^(bool|boolean)$/, "boolean"],
  [/^(varchar|character varying)(\(\d+\))?$/, "character varying"],
  [/^bit\(\d+\)$/, "bit"],
  [/^numeric(\(.*\))?$/, "numeric"],
  [/^(real|float4)$/, "real"],
  [/^(double precision|float8)$/, "double precision"],
];
export function normType(t: string): string {
  const s = t.toLowerCase().trim();
  if (s.endsWith("[]")) return "ARRAY";
  for (const [re, v] of TYPE_MAP) if (re.test(s)) return v;
  return s;
}

/** 최상위 쉼표로 자른다(괄호 깊이·따옴표 고려). */
function splitTop(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = false;
  let cur = "";
  for (const ch of body) {
    if (ch === "'") quote = !quote;
    if (!quote) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        out.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const stripComments = (sql: string): string =>
  sql
    .split("\n")
    .map((l) => {
      let quote = false;
      for (let i = 0; i < l.length - 1; i++) {
        if (l[i] === "'") quote = !quote;
        if (!quote && l[i] === "-" && l[i + 1] === "-") return l.slice(0, i);
      }
      return l;
    })
    .join("\n");

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

export function parseDdl(md: string): TableSpec[] {
  const start = md.indexOf("### 6.3.3 DDL");
  const b = md.indexOf("```sql", start);
  const e = md.indexOf("\n```", b + 6);
  const raw = md.slice(b + 6, e);
  const localAt = raw.indexOf("-- ===== 9000_local_only");
  const sql = stripComments(raw);
  const localStart = localAt < 0 ? Infinity : stripComments(raw.slice(0, localAt)).length;
  const tables: TableSpec[] = [];
  const re = /create table (\w+) \(/gi;
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < sql.length && depth > 0; i++) {
      if (sql[i] === "(") depth++;
      if (sql[i] === ")") depth--;
    }
    const body = sql.slice(re.lastIndex, i - 1);
    const cols: ColSpec[] = [];
    const cons = { p: 0, f: 0, u: 0, c: 0 };
    for (const part of splitTop(body)) {
      const low = part.toLowerCase();
      if (/^(constraint \w+ )?(check|primary key|foreign key|unique)\b/.test(low)) {
        if (/^(constraint \w+ )?check\b/.test(low)) cons.c++;
        else if (/primary key/.test(low)) cons.p++;
        else if (/foreign key/.test(low)) cons.f++;
        else cons.u++;
        continue;
      }
      const cm =
        /^(\w+)\s+((?:double precision|timestamp with time zone|character varying(?:\(\d+\))?|\w+(?:\([\d, ]+\))?)(?:\[\])?)/i.exec(
          part,
        );
      if (!cm?.[1] || !cm[2]) throw new Error(`${m[1]}: 컬럼 해석 실패 "${part}"`);
      const rest = low.slice(cm[0].length);
      const pk = /\bprimary key\b/.test(rest);
      cols.push({
        name: cm[1],
        type: normType(cm[2]),
        notNull: pk || /\bnot null\b/.test(rest),
      });
      if (pk) cons.p++;
      if (/\breferences\b/.test(rest)) cons.f++;
      if (/\bunique\b/.test(rest)) cons.u++;
      cons.c += count(rest, /\bcheck\s*\(/g);
    }
    tables.push({ name: m[1] ?? "", localOnly: m.index >= localStart, cols, cons });
  }
  // create table 밖에서 추가하는 제약(alter table … add constraint …)
  const alt =
    /alter table (\w+) add (?:constraint \w+\s+)?(check|primary key|foreign key|unique)\b/gi;
  for (let m = alt.exec(sql); m; m = alt.exec(sql)) {
    const t = tables.find((x) => x.name === m?.[1]);
    const kind = (m[2] ?? "").toLowerCase();
    if (!t) throw new Error(`alter table 대상 없음: ${m[1]}`);
    if (kind === "check") t.cons.c++;
    else if (kind === "primary key") t.cons.p++;
    else if (kind === "foreign key") t.cons.f++;
    else t.cons.u++;
  }
  return tables;
}

export async function schemaParity(root: string, url: string, local: boolean): Promise<string[]> {
  const md = readFileSync(join(root, "docs/spec/FINAL/06_architecture.md"), "utf8");
  const spec = parseDdl(md).filter((t) => local || !t.localOnly);
  const db = createDbPort(url);
  const diffs: string[] = [];
  try {
    await db.withService(async (tx) => {
      const tabs = new Set(
        (await q(tx, "select tablename from pg_tables where schemaname = 'public'")).rows.map((r) =>
          String(r.tablename),
        ),
      );
      const specNames = new Set(spec.map((t) => t.name));
      for (const t of tabs) if (!specNames.has(t)) diffs.push(`DB에만 있는 테이블: ${t}`);
      for (const t of spec) {
        if (!tabs.has(t.name)) {
          diffs.push(`마이그레이션에 없는 테이블: ${t.name}`);
          continue;
        }
        const cols = (
          await q(
            tx,
            `select column_name, data_type, is_nullable from information_schema.columns
             where table_schema = 'public' and table_name = $1`,
            [t.name],
          )
        ).rows;
        const got = new Map(cols.map((c) => [String(c.column_name), c]));
        for (const c of t.cols) {
          const g = got.get(c.name);
          if (!g) {
            diffs.push(`${t.name}.${c.name}: 컬럼 없음`);
            continue;
          }
          if (String(g.data_type) !== c.type)
            diffs.push(`${t.name}.${c.name}: 타입 ${String(g.data_type)} ≠ ${c.type}`);
          if ((g.is_nullable === "NO") !== c.notNull)
            diffs.push(`${t.name}.${c.name}: NOT NULL ${String(g.is_nullable)} ≠ 사양`);
          got.delete(c.name);
        }
        for (const extra of got.keys()) diffs.push(`${t.name}.${extra}: 사양에 없는 컬럼`);
        const cons = (
          await q(
            tx,
            `select contype, count(*)::int as n from pg_constraint
             where conrelid = ('public.' || $1)::regclass and contype in ('p','f','u','c') group by contype`,
            [t.name],
          )
        ).rows;
        const n = Object.fromEntries(cons.map((r) => [String(r.contype), Number(r.n)]));
        for (const k of ["p", "f", "u", "c"] as const)
          if ((n[k] ?? 0) !== t.cons[k])
            diffs.push(`${t.name}: 제약 ${k} 수 ${n[k] ?? 0} ≠ 사양 ${t.cons[k]}`);
      }
    });
  } finally {
    await db.close();
  }
  return diffs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const env = withDotenv(root);
  const url = env.DATABASE_URL_DIRECT;
  if (!url) {
    process.stderr.write("schema-parity: DATABASE_URL_DIRECT 없음\n");
    process.exit(1);
  }
  schemaParity(root, url, (env.APP_ENV ?? "local") === "local").then(
    (d) => {
      for (const x of d) process.stdout.write(`DIFF ${x}\n`);
      process.stdout.write(`schema-parity: 차이 ${d.length}건\n`);
      process.exit(d.length === 0 ? 0 : 1);
    },
    (e: unknown) => {
      process.stderr.write(`schema-parity 실패: ${(e as Error).message}\n`);
      process.exit(1);
    },
  );
}
