// M1 수용 테스트: 마이그레이션·RLS·쓰기 화이트리스트·제약·시드·타입(09장 9.4.3 ⑤~⑨,
// AC-06-01~07·51, AC-05-02·04). native 프로파일(시스템 PG16 + shim, 접속 사용자 tastefit_app) 기준.
// 앱 쿼리는 DbPort(withUser·withAnon·withService)만 쓴다(06장 R-5). 픽스처 행 생성은 packages/db 테스트 헬퍼(ASM-008).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROOT, git, run, tmpRepo } from "../_support/sh.js";
import { createDbPort, q, type DbPort, type Tx } from "../../../packages/db/src/index.js";
import {
  insertAuditLog,
  insertJob,
  insertSurveyItem,
  seedOwnership,
  type Ownership,
} from "../../../packages/db/src/testing/fixtures.js";

/** 이 파일 전용 DB(개발 DB·다른 테스트와 분리). */
const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m1acc";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

/** 거부(42501)는 "보이는 행 0"으로 센다(AC-06-03, ASM-008). 그 밖의 오류는 그대로 던진다. */
async function visible(tx: Tx, table: string, where = "true", params: unknown[] = []) {
  try {
    return (await q(tx, `select 1 from ${table} where ${where}`, params)).rowCount;
  } catch (e) {
    if ((e as { code?: string }).code === PERMISSION_DENIED) return 0;
    throw e;
  }
}
async function errorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
}
async function publicTables(db: DbPort): Promise<string[]> {
  return db.withService(async (tx) =>
    (
      await q(tx, "select tablename from pg_tables where schemaname = 'public' order by 1")
    ).rows.map((r) => String(r.tablename)),
  );
}
async function rowCounts(db: DbPort): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of await publicTables(db))
    out[t] = await db.withService(async (tx) =>
      Number((await q(tx, `select count(*)::int as n from ${t}`)).rows[0]?.n),
    );
  return out;
}

let db: DbPort;
let own: Ownership;

describe("M1 마이그레이션", () => {
  beforeAll(async () => {
    const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
    expect(up.code, up.out).toBe(0);
  });

  it("AC-06-01 / AC-06-51 / 9.4.3 ⑤: native 빈 DB(drop/create)에 shim+마이그레이션 적용 2회 ON_ERROR_STOP 성공", async () => {
    for (const round of ["1회", "2회"]) {
      const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
      expect(r.code, `${round}: ${r.out}`).toBe(0);
    }
  });

  it("9.4.3 ⑨: verify:schema-parity — 06장 DDL과 information_schema 차이 0", async () => {
    const r = await run("pnpm", ["-s", "verify:schema-parity"], ROOT, ENV);
    expect(r.code, r.out).toBe(0);
  });
});

describe("M1 RLS·권한·제약", () => {
  beforeAll(async () => {
    db = createDbPort(DB_URL);
    own = await seedOwnership(db);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("AC-06-02 / AC-06-51: public의 모든 테이블이 rowsecurity·forcerowsecurity = true", async () => {
    const rows = await db.withService(
      async (tx) =>
        (
          await q(
            tx,
            `select c.relname, c.relrowsecurity, c.relforcerowsecurity
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
             join pg_tables t on t.schemaname = n.nspname and t.tablename = c.relname
             where n.nspname = 'public'`,
          )
        ).rows,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.relrowsecurity, String(r.relname)).toBe(true);
      expect(r.relforcerowsecurity, String(r.relname)).toBe(true);
    }
  });

  it("AC-06-03 / 9.4.3 ⑦: 사용자 B는 A의 소유 행 0, A는 자기 행을 본다(대조군)", async () => {
    for (const [table, id] of Object.entries(own.owned)) {
      const asA = await db.withUser(own.a, "aal1", (tx) => visible(tx, table, "id = $1", [id]));
      expect(asA, `A→${table}`).toBe(1);
      const asB = await db.withUser(own.b, "aal1", (tx) => visible(tx, table, "id = $1", [id]));
      expect(asB, `B→${table}`).toBe(0);
    }
  });

  it("AC-06-03 / 9.4.3 ⑦: withAnon으로 diagnosis_sessions·survey_answers·brief_drafts·reference_sites 0행", async () => {
    for (const table of [
      "diagnosis_sessions",
      "survey_answers",
      "brief_drafts",
      "reference_sites",
    ]) {
      const n = await db.withService((tx) => visible(tx, table));
      expect(n, `service→${table}`).toBeGreaterThan(0);
      expect(await db.withAnon((tx) => visible(tx, table)), `anon→${table}`).toBe(0);
    }
  });

  it("AC-06-03b: 사용자 A의 화이트리스트 밖 쓰기 4종은 42501이고 DB 변경 0", async () => {
    const o = own.owned;
    const before = await rowCounts(db);
    const snap = async () =>
      db.withService(async (tx) => ({
        title: (await q(tx, "select title from projects where id = $1", [o.projects])).rows[0],
        cur: (await q(tx, "select current_version_id from mockups where id = $1", [o.mockups]))
          .rows[0],
        hidden: (await q(tx, "select hidden_at from share_links where id = $1", [o.share_links]))
          .rows[0],
      }));
    const s0 = await snap();
    const attempts: [string, string, unknown[]][] = [
      [
        "projects INSERT",
        `insert into projects (owner_id, taste_snapshot, purpose, brand, brand_hash, title)
         values ($1, '{}', 'saas', '{}', 'h', 't')`,
        [own.a],
      ],
      ["projects UPDATE", "update projects set title = 'x' where id = $1", [o.projects]],
      [
        "mockup_versions INSERT passed",
        `insert into mockup_versions (mockup_id, owner_id, version_no, change_source, tokens, layout_tree, gate_status, render_hash)
         values ($1, $2, 99, 'edit_manual', '{}', '{}', 'passed', 'h')`,
        [o.mockups, own.a],
      ],
      [
        "share_links INSERT",
        `insert into share_links (id, target_type, mockup_id, version_id, owner_user_id, is_public)
         values ('AAAAAAAAAAAAAAAAAAAAAA', 'mockup', $1, $2, $3, true)`,
        [o.mockups, o.mockup_versions, own.a],
      ],
      [
        "share_links hidden_at=null",
        "update share_links set hidden_at = null where id = $1",
        [o.share_links],
      ],
      [
        "mockups.current_version_id",
        "update mockups set current_version_id = $2 where id = $1",
        [o.mockups, o.mockup_versions],
      ],
    ];
    for (const [name, sql, params] of attempts) {
      const code = await errorCode(db.withUser(own.a, "aal1", (tx) => q(tx, sql, params)));
      expect(code, name).toBe(PERMISSION_DENIED);
    }
    expect(await rowCounts(db)).toEqual(before);
    expect(await snap()).toEqual(s0);
  });

  it("AC-06-03b: 같은 사용자의 mockups.feedback·users.display_name UPDATE는 성공", async () => {
    const fb = await db.withUser(own.a, "aal1", (tx) =>
      q(tx, "update mockups set feedback = 'up' where id = $1", [own.owned.mockups]),
    );
    expect(fb.rowCount).toBe(1);
    const dn = await db.withUser(own.a, "aal1", (tx) =>
      q(tx, "update users set display_name = '에이' where id = $1", [own.a]),
    );
    expect(dn.rowCount).toBe(1);
  });

  it("AC-06-03b: anon의 INSERT·UPDATE·DELETE는 모든 public 테이블에서 실패", async () => {
    for (const t of await publicTables(db)) {
      const col = await db.withService(
        async (tx) =>
          (
            await q(
              tx,
              `select column_name from information_schema.columns
               where table_schema = 'public' and table_name = $1 order by ordinal_position limit 1`,
              [t],
            )
          ).rows[0]?.column_name,
      );
      for (const [op, sql] of [
        ["INSERT", `insert into ${t} default values`],
        ["UPDATE", `update ${t} set ${String(col)} = ${String(col)} where false`],
        ["DELETE", `delete from ${t} where false`],
      ] as const) {
        const code = await errorCode(db.withAnon((tx) => q(tx, sql)));
        expect(code, `anon ${op} ${t}`).toBe(PERMISSION_DENIED);
      }
    }
  });

  it("AC-05-04: reference_*·vlm_tags·normalizers SELECT는 anon·authenticated에서 거부", async () => {
    const tables = (await publicTables(db)).filter(
      (t) => t.startsWith("reference_") || t === "vlm_tags" || t === "normalizers",
    );
    expect(tables).toContain("reference_sites");
    expect(tables).toContain("normalizers");
    for (const t of tables) {
      expect(await errorCode(db.withAnon((tx) => q(tx, `select 1 from ${t}`))), `anon ${t}`).toBe(
        PERMISSION_DENIED,
      );
      expect(
        await errorCode(db.withUser(own.a, "aal1", (tx) => q(tx, `select 1 from ${t}`))),
        `authenticated ${t}`,
      ).toBe(PERMISSION_DENIED);
    }
  });

  it("AC-05-04: 사용자 쪽 레퍼런스 뷰 similar_site_candidates 컬럼은 06장 정의와 같고 스크린샷 컬럼 없음", async () => {
    const cols = await db.withService(async (tx) =>
      (
        await q(
          tx,
          `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'similar_site_candidates'`,
        )
      ).rows
        .map((r) => String(r.column_name))
        .sort(),
    );
    expect(cols).toEqual(
      ["blurb_ko", "domain", "id", "l1", "title_ko", "type_primary", "url", "use"].sort(),
    );
    expect(
      await errorCode(db.withAnon((tx) => q(tx, "select * from similar_site_candidates"))),
    ).toBe(undefined);
  });

  it("AC-06-04: survey_items.x_card is_l1 CHECK — 키 4개·A1 키·값 1.01 거부, 데스크톱 bytes 143361 거부", async () => {
    const good = { expression: 0.2, temperature: 0.4, shape: 0.6, density: 0.8, depth: 1 };
    expect(await errorCode(insertSurveyItem(db, { id: "C-SV01-hero", xCard: good }))).toBe(
      undefined,
    );
    const four: Record<string, number> = { ...good };
    delete four.depth;
    const bad: [string, Record<string, number>][] = [
      ["키 4개", four],
      ["A1 키", { A1: 0.2, temperature: 0.4, shape: 0.6, density: 0.8, depth: 1 }],
      ["값 1.01", { ...good, depth: 1.01 }],
    ];
    for (const [name, xCard] of bad)
      expect(await errorCode(insertSurveyItem(db, { id: "C-SV02-hero", xCard })), name).toBe(
        CHECK_VIOLATION,
      );
    expect(
      await errorCode(
        insertSurveyItem(db, { id: "C-SV03-hero", xCard: good, desktopBytes: 143361 }),
      ),
    ).toBe(CHECK_VIOLATION);
  });

  it("AC-06-05: queued 잡이 있는 사용자의 두 번째 잡 INSERT는 gen_one_active_per_user 위반", async () => {
    await insertJob(db, { ownerId: own.b, status: "queued" });
    try {
      await insertJob(db, { ownerId: own.b, status: "queued" });
      expect.unreachable("두 번째 잡이 들어갔다");
    } catch (e) {
      expect((e as { code?: string }).code).toBe(UNIQUE_VIOLATION);
      expect((e as { constraint?: string }).constraint).toBe("gen_one_active_per_user");
    }
  });

  it("AC-06-06: admin_audit_logs UPDATE·1년 이내 DELETE는 service role에서도 실패, 400일 행은 purge로만 삭제", async () => {
    const recent = await insertAuditLog(db, { ageDays: 0 });
    const old = await insertAuditLog(db, { ageDays: 400 });
    const exists = (id: string) =>
      db.withService(
        async (tx) => (await q(tx, "select 1 from admin_audit_logs where id = $1", [id])).rowCount,
      );
    expect(
      await errorCode(
        db.withService((tx) =>
          q(tx, "update admin_audit_logs set action = 'x' where id = $1", [recent]),
        ),
      ),
    ).toBeDefined();
    for (const id of [recent, old])
      expect(
        await errorCode(
          db.withService((tx) => q(tx, "delete from admin_audit_logs where id = $1", [id])),
        ),
      ).toBeDefined();
    await errorCode(db.withService((tx) => q(tx, "select purge_audit_logs(now())")));
    expect(await exists(recent)).toBe(1);
    expect(await exists(old)).toBe(1);
    await db.withService((tx) => q(tx, "select purge_audit_logs(now() - interval '1 year')"));
    expect(await exists(old)).toBe(0);
    expect(await exists(recent)).toBe(1);
  });

  it("AC-06-07: generation_jobs.cost_usd는 0.9 저장 성공(상한 CHECK 없음), 음수는 CHECK 위반", async () => {
    const id = await insertJob(db, { ownerId: own.a, status: "succeeded", costUsd: 0.9 });
    const v = await db.withService(
      async (tx) =>
        (await q(tx, "select cost_usd::text as c from generation_jobs where id = $1", [id])).rows[0]
          ?.c,
    );
    expect(Number(v)).toBe(0.9);
    expect(
      await errorCode(insertJob(db, { ownerId: own.a, status: "failed", costUsd: -0.01 })),
    ).toBe(CHECK_VIOLATION);
  });
});

describe("M1 시드·타입", () => {
  beforeAll(async () => {
    const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
    expect(r.code, r.out).toBe(0);
    db = createDbPort(DB_URL);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("9.4.3 ⑥: db:seed 2회 실행 후 모든 테이블 행 수 동일(멱등)", async () => {
    const r1 = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
    expect(r1.code, r1.out).toBe(0);
    const c1 = await rowCounts(db);
    expect(c1.types).toBe(8);
    const r2 = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
    expect(r2.code, r2.out).toBe(0);
    expect(await rowCounts(db)).toEqual(c1);
  });

  it("AC-05-02: 시드 레퍼런스 60개 모두 primary 라벨에 5축(축별 판단 불가 ≤ 5%)·L2·유형·체크리스트", async () => {
    const rows = await db.withService(
      async (tx) =>
        (
          await q(
            tx,
            `select r.id, l.axes, l.l2, l.type_primary, l.checklist
             from reference_sites r
             left join reference_labels l on l.reference_id = r.id and l.purpose = 'primary'
             where r.role = 'seed'`,
          )
        ).rows,
    );
    expect(new Set(rows.map((r) => r.id)).size).toBe(60);
    const unknown: Record<string, number> = {};
    for (const r of rows) {
      expect(r.axes, String(r.id)).not.toBeNull();
      expect(Object.keys(r.axes as object).sort()).toEqual([
        "density",
        "depth",
        "expression",
        "shape",
        "temperature",
      ]);
      for (const [k, v] of Object.entries(r.axes as Record<string, unknown>))
        if (v === null) unknown[k] = (unknown[k] ?? 0) + 1;
      expect(r.l2, String(r.id)).not.toBeNull();
      expect(String(r.type_primary)).toMatch(/^T[1-8]$/);
      expect(r.checklist, String(r.id)).not.toBeNull();
    }
    // 축별 판단 불가 ≤ 5% = 60개 중 3개 이하(05장 AC-05-02).
    for (const [k, n] of Object.entries(unknown))
      expect(n * 20, k).not.toBeGreaterThan(rows.length);
  });

  it("9.4.3 ⑧: db:types 산출이 커밋본과 같고 web·worker 양쪽에서 컴파일", async () => {
    const d = tmpRepo();
    const g = await run("pnpm", ["-s", "db:types"], d, ENV);
    expect(g.code, g.out).toBe(0);
    expect(git(d, "status", "--porcelain", "packages/db/src/types.gen.ts")).toBe("");
    for (const app of ["web", "worker"]) {
      const t = await run("pnpm", ["-s", "--filter", `./apps/${app}`, "run", "typecheck"], d);
      expect(t.code, `${app}: ${t.out}`).toBe(0);
    }
  });
});
