// M5 수용 테스트(2/7): 브랜드 입력·BrandInput 검증·정규화·마스킹·남용 판정(06장 6.4.5 ①~⑤, 01장 1.5.5.2·1.5.5.3,
// 07장 TC-B-03·05~07·13~17·19, 08장 8.7.5·8.9.2 AC-08-41). 경로 = 익명 POST /api/brief-drafts → GET /api/brief-drafts/:id.
// 픽스처: fixtures/brands/{normal,security,high-risk}.json(09장 9.4.7 산출물). 계약: ASSUMPTIONS ASM-105.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import { seedSimilarSites, seedSurveyFixture } from "../../../packages/db/src/testing/fixtures.js";
import { judgeAbuse } from "../../../packages/compliance/src/abuse.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5brief";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
let db: DbPort;
let deps: Deps;

type Brand = Record<string, unknown>;
interface Res {
  status: number;
  body: Record<string, unknown>;
}
interface Expect {
  status: number;
  stored?: Record<string, string>;
  storedNot?: Record<string, string[]>;
  masked?: Record<string, number>;
  paths?: string[];
  code?: string;
  reason?: string;
}
const fx = <T>(f: string): T =>
  JSON.parse(readFileSync(join(ROOT, "fixtures/brands", f), "utf8")) as T;
const NORMAL = fx<{ items: { id: string; purpose: string; brand: Brand }[] }>("normal.json").items;
const SECURITY = fx<{
  items: { id: string; case: string; purpose: string; brand: Brand; expect: Expect }[];
}>("security.json").items;
const HIGH = fx<{ blocked: { name: string; ref: string; variant: string }[]; normal: string[] }>(
  "high-risk.json",
);

class Jar {
  m = new Map<string, string>();
  take(h: Headers): void {
    for (const sc of h.getSetCookie()) {
      const [kv = ""] = sc.split(";");
      const [k = "", v = ""] = kv.split("=");
      this.m.set(k.trim(), v.trim());
    }
  }
  header(): string {
    return [...this.m].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}
async function call(jar: Jar, method: string, path: string, body?: unknown): Promise<Res> {
  const h = new Headers({ origin: ORIGIN });
  if (method !== "GET") h.set("content-type", "application/json");
  if (jar.m.size) h.set("cookie", jar.header());
  const res = await handle(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: h,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    deps,
  );
  jar.take(res.headers);
  const t = await res.text();
  return {
    status: res.status,
    body: t.startsWith("{") ? (JSON.parse(t) as Record<string, unknown>) : {},
  };
}
type View = {
  id: string;
  resultId: string | null;
  question: { seq: number; itemKey: string; items: string[] } | null;
};
/** 익명 진단 완료 → resultId. */
async function completeSurvey(jar: Jar): Promise<string> {
  let v = (await call(jar, "POST", "/api/surveys", { entry: "landing" })).body as unknown as View;
  while (v.question)
    v = (
      await call(jar, "POST", `/api/surveys/${v.id}/responses`, {
        seq: v.question.seq,
        itemKey: v.question.itemKey,
        shownItemIds: v.question.items,
        answer: "option",
        chosenItemId: v.question.items[0],
        latencyMs: 1500,
        clientTs: new Date().toISOString(),
      })
    ).body as unknown as View;
  expect(v.resultId).toMatch(/^[0-9a-f-]{36}$/);
  return v.resultId ?? "";
}
let jar: Jar;
let resultId = "";
const draft = (purpose: string, brand: Brand, j: Jar = jar, rid = resultId) =>
  call(j, "POST", "/api/brief-drafts", { resultId: rid, purpose, brand, useSampleContent: false });
const issuesOf = (r: Res): string[] =>
  (
    (
      (r.body.error as Record<string, unknown> | undefined)?.details as
        { issues?: { path: string }[] } | undefined
    )?.issues ?? []
  ).map((i) => i.path);
const errOf = (r: Res) =>
  r.body.error as { code: string; details?: { reason?: string } } | undefined;
/** 저장된 brand(GET 복원값). */
async function stored(r: Res): Promise<Brand> {
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const g = await call(jar, "GET", `/api/brief-drafts/${String(r.body.briefDraftId)}`);
  expect(g.status).toBe(200);
  return g.body.brand as Brand;
}
const base = (over: Brand = {}): Brand => ({
  name: "마루 도예",
  description: "손으로 빚는 생활 도자기 공방입니다",
  primaryAction: "visit",
  ...over,
});

beforeAll(async () => {
  const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
  expect(up.code, up.out).toBe(0);
  const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
  expect(r.code, r.out).toBe(0);
  const s = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
  expect(s.code, s.out).toBe(0);
  db = createDbPort(DB_URL);
  await seedSurveyFixture(db);
  await seedSimilarSites(db);
  deps = { db, webOrigin: ORIGIN };
  jar = new Jar();
  resultId = await completeSurvey(jar);
});
afterAll(async () => {
  await db?.close();
});

describe("BrandInput 정상 픽스처(09장 9.4.7 정상 10)", () => {
  it("정상 10건: 201, maskedFields 빈 객체, 저장값 = 입력값, expiresAt ≈ +24h, 응답에 원문 외 필드 없음", async () => {
    expect(NORMAL.length).toBeGreaterThanOrEqual(10);
    for (const n of NORMAL) {
      const r = await draft(n.purpose, n.brand);
      expect(r.status, `${n.id} ${JSON.stringify(r.body)}`).toBe(201);
      expect(r.body.maskedFields, n.id).toEqual({});
      const ttlH = (Date.parse(String(r.body.expiresAt)) - Date.now()) / 3_600_000;
      expect(ttlH, n.id).toBeGreaterThan(23.9);
      expect(ttlH, n.id).toBeLessThanOrEqual(24.01);
      const g = await call(jar, "GET", `/api/brief-drafts/${String(r.body.briefDraftId)}`);
      expect(g.body.brand, n.id).toEqual(n.brand);
      expect(g.body.purpose).toBe(n.purpose);
      expect(g.body.resultId).toBe(resultId);
      expect(g.body.useSampleContent).toBe(false);
    }
  });
  it("D-0620 남의 임시본 GET → 404, 남의 resultId로 POST → 404", async () => {
    const r = await draft("saas", base({ primaryAction: "signup" }));
    const other = new Jar();
    await call(other, "POST", "/api/surveys", { entry: "landing" });
    expect(
      (await call(other, "GET", `/api/brief-drafts/${String(r.body.briefDraftId)}`)).status,
    ).toBe(404);
    expect((await draft("saas", base({ primaryAction: "signup" }), other)).status).toBe(404);
  });
});

describe("6.4.5 ①~⑤ 보안 페이로드(fixtures/brands/security.json)", () => {
  it("보안 페이로드 ≥ 10건이 기대 결과(정규화 저장·400 경로·422 사유·마스킹 건수)와 같다", async () => {
    expect(SECURITY.length).toBeGreaterThanOrEqual(10);
    for (const c of SECURITY) {
      const r = await draft(c.purpose, c.brand);
      const tag = `${c.id} ${c.case} ${JSON.stringify(r.body)}`;
      expect(r.status, tag).toBe(c.expect.status);
      if (c.expect.status === 400) {
        expect(errOf(r)?.code, tag).toBe("VALIDATION_FAILED");
        for (const p of c.expect.paths ?? []) expect(issuesOf(r), tag).toContain(p);
      }
      if (c.expect.status === 422) {
        expect(errOf(r)?.code, tag).toBe(c.expect.code);
        expect(errOf(r)?.details?.reason, tag).toBe(c.expect.reason);
      }
      if (c.expect.status !== 201) continue;
      expect(r.body.maskedFields, tag).toEqual(c.expect.masked ?? {});
      const b = await stored(r);
      for (const [k, v] of Object.entries(c.expect.stored ?? {})) expect(b[k], tag).toBe(v);
      for (const [k, subs] of Object.entries(c.expect.storedNot ?? {}))
        for (const s of subs) expect(String(b[k]), tag).not.toContain(s);
    }
  });
  it("원문은 어디에도 남지 않는다: 마스킹 대상 원문이 brief_drafts 행 전체에 0건", async () => {
    const raw = "010-9876-5432";
    const r = await draft("local_business", base({ description: `전화 ${raw} 로 예약해 주세요` }));
    expect(r.body.maskedFields).toEqual({ phone: 1 });
    const row = await db.withService((tx) =>
      q(tx, "select row_to_json(b)::text as t from brief_drafts b where id = $1", [
        r.body.briefDraftId,
      ]),
    );
    expect(String(row.rows[0]?.t)).not.toContain(raw);
  });
});

describe("TC-B-13 경계값·TC-B-03 grapheme·TC-B-19 색", () => {
  const g = (n: number, ch = "가") => ch.repeat(n);
  const cases: [string, Brand, boolean][] = [
    ["name 30자(상한)", base({ name: g(30) }), true],
    ["name W 30자(TC-B-02)", base({ name: g(30, "W") }), true],
    ["name 31자", base({ name: g(31) }), false],
    ["name 이모지 grapheme 30", base({ name: g(29) + "👨‍👩‍👧" }), true],
    ["name 이모지 grapheme 31", base({ name: g(30) + "👨‍👩‍👧" }), false],
    ["description 10자(하한)", base({ description: g(10) }), true],
    ["description 9자", base({ description: g(9) }), false],
    ["description 80자(상한)", base({ description: g(80) }), true],
    ["description 81자", base({ description: g(81) }), false],
    ["primaryActionLabel 2자", base({ primaryActionLabel: g(2) }), true],
    ["primaryActionLabel 1자", base({ primaryActionLabel: g(1) }), false],
    ["primaryActionLabel 12자", base({ primaryActionLabel: g(12) }), true],
    ["primaryActionLabel 13자", base({ primaryActionLabel: g(13) }), false],
    ["audience 40자", base({ audience: g(40) }), true],
    ["audience 41자", base({ audience: g(41) }), false],
    ["keyPoints 3개", base({ keyPoints: ["가나", "다라", "마바"] }), true],
    ["keyPoints 4개", base({ keyPoints: ["가나", "다라", "마바", "사아"] }), false],
    ["keyPoints 항목 1자", base({ keyPoints: ["가"] }), false],
    ["keyPoints 항목 40자", base({ keyPoints: [g(40)] }), true],
    ["keyPoints 항목 41자", base({ keyPoints: [g(41)] }), false],
    ["brandColor 1F2A44(# 없음)", base({ brandColor: "1F2A44" }), false],
    ["brandColor #GGGGGG", base({ brandColor: "#GGGGGG" }), false],
  ];
  it("상한 정확히 = 허용, 상한+1·하한−1 = 400(AC-01-25)", async () => {
    for (const [label, b, ok] of cases) {
      const r = await draft("local_business", b);
      expect(r.status, `${label} ${JSON.stringify(r.body)}`).toBe(ok ? 201 : 400);
    }
  });
  it("TC-B-19 #1f2a44 → #1F2A44, #abc → #AABBCC, TC-B-03 이모지 이름 원문 유지", async () => {
    expect(
      (await stored(await draft("local_business", base({ brandColor: "#1f2a44" })))).brandColor,
    ).toBe("#1F2A44");
    expect(
      (await stored(await draft("local_business", base({ brandColor: "#abc" })))).brandColor,
    ).toBe("#AABBCC");
    expect((await stored(await draft("local_business", base({ name: "👨‍👩‍👧카페" })))).name).toBe(
      "👨‍👩‍👧카페",
    );
  });
});

describe("AC-08-41 고위험 브랜드 20종 거부 100%, 일반 50종 오탐 0", () => {
  it("AC-08-41 판정 함수: 20종 모두 의도한 브랜드 id로 high_risk(8.9.2 (a)~(c)), 일반 50종 위반 0", () => {
    expect(HIGH.blocked).toHaveLength(20);
    expect(HIGH.normal).toHaveLength(50);
    for (const b of HIGH.blocked) {
      const refs = judgeAbuse([b.name])
        .filter((v) => v.reason === "high_risk")
        .map((v) => v.ref);
      expect(refs, `${b.name} (${b.variant})`).toContain(b.ref);
    }
    for (const n of HIGH.normal) expect(judgeAbuse([n]), n).toEqual([]);
  });
  it("AC-08-41 API: 20종 422 BLOCKED_BRAND reason=high_risk + admin_audit_logs brand_blocked(원문 0), 50종 201", async () => {
    const count = async () =>
      Number(
        (
          await db.withService((tx) =>
            q(tx, "select count(*)::int as n from admin_audit_logs where action = 'brand_blocked'"),
          )
        ).rows[0]?.n,
      );
    const before = await count();
    for (const b of HIGH.blocked) {
      const r = await draft("local_business", base({ name: b.name }));
      expect(r.status, `${b.name} ${JSON.stringify(r.body)}`).toBe(422);
      expect(errOf(r)?.code).toBe("BLOCKED_BRAND");
      expect(errOf(r)?.details?.reason).toBe("high_risk");
    }
    expect(await count()).toBe(before + HIGH.blocked.length);
    const rows = await db.withService((tx) =>
      q(
        tx,
        "select target_id, coalesce(after::text, '') as a from admin_audit_logs where action = 'brand_blocked'",
      ),
    );
    for (const row of rows.rows) {
      expect(String(row.target_id)).toMatch(/^[0-9a-f]{64}$/);
      for (const b of HIGH.blocked) expect(String(row.a)).not.toContain(b.name);
    }
    for (const n of HIGH.normal) {
      const r = await draft("local_business", base({ name: n }));
      expect(r.status, `${n} ${JSON.stringify(r.body)}`).toBe(201);
    }
  });
});
