// M4 수용 테스트(4/7): 진단 API·익명 세션·멱등·CSRF·소유·p95(06장 6.2.2·6.4.3·6.4.4·6.5.1,
// AC-06-11·12·46, AC-02-08(API)·37(503), 09장 9.4.6 ⑤⑥⑦). 계약은 ASSUMPTIONS ASM-095:
// 라우트는 apps/web/src/server/api.ts의 handle(req, deps)로 in-process 호출한다(Next 라우트 파일은 이것만 위임).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getThresholds } from "../../../packages/config/src/index.js";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import { seedSimilarSites, seedSurveyFixture } from "../../../packages/db/src/testing/fixtures.js";
import {
  SurveyViewSchema,
  ResultViewSchema,
  SurveyItemsViewSchema,
} from "../../../packages/api-contract/src/index.js";
import { handle } from "../../../apps/web/src/server/api.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m4api";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const TH = getThresholds() as unknown as {
  perf: { surveyServerP95Ms: number; surveyApiP95Ms: number };
  diagnosis: { maxQuestions: number; similarSites: { count: number } };
};
const PERF = TH.perf;
const MAXQ = TH.diagnosis.maxQuestions;
const TYPES = (
  JSON.parse(readFileSync(join(ROOT, "data/taxonomy/types.json"), "utf8")) as {
    items: { id: string }[];
  }
).items.map((t) => t.id);

let db: DbPort;
interface Res {
  status: number;
  body: Record<string, unknown>;
  cookie: string | null;
  headers: Headers;
}
async function call(
  method: string,
  path: string,
  o: { body?: unknown; cookie?: string | null; origin?: string } = {},
): Promise<Res> {
  const h = new Headers();
  if (o.body !== undefined) h.set("content-type", "application/json");
  if (method !== "GET") h.set("origin", o.origin ?? ORIGIN);
  if (o.cookie) h.set("cookie", o.cookie);
  const req = new Request(`${ORIGIN}${path}`, {
    method,
    headers: h,
    ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
  });
  const res = await handle(req, { db, webOrigin: ORIGIN });
  const sc = res.headers.get("set-cookie");
  const m = sc ? /anon_id=([^;]+)/.exec(sc) : null;
  const text = await res.text();
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    cookie: m ? `anon_id=${m[1]}` : (o.cookie ?? null),
    headers: res.headers,
  };
}
type View = {
  id: string;
  status: string;
  answered: number;
  canUndo: boolean;
  resultId: string | null;
  state: { mu?: number[] } & Record<string, unknown>;
  question: { seq: number; itemKey: string; kind: string; items: string[] } | null;
};
const view = (r: Res): View => SurveyViewSchema.parse(r.body) as unknown as View;
const answerOf = (v: View, pick = 0) => ({
  seq: v.question!.seq,
  itemKey: v.question!.itemKey,
  shownItemIds: v.question!.items,
  answer: "option",
  chosenItemId: v.question!.items[pick % v.question!.items.length],
  latencyMs: 1500,
  clientTs: new Date().toISOString(),
});
const count = async (table: string): Promise<number> =>
  Number(
    (await db.withService((tx) => q(tx, `select count(*)::int as n from ${table}`))).rows[0]?.n ??
      0,
  );

beforeAll(async () => {
  const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
  expect(up.code, up.out).toBe(0);
  const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
  expect(r.code, r.out).toBe(0);
  const s = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
  expect(s.code, s.out).toBe(0);
  db = createDbPort(DB_URL);
  await seedSurveyFixture(db); // 카드 48·A/B 120쌍 전부 active, x = 계획 L1
  await seedSimilarSites(db); // 2.14 후보 뷰(유형 중심마다 3곳)
});
afterAll(async () => {
  await db?.close();
});

describe("6.4.3 GET /api/survey-items · AC-02-08(API)", () => {
  it("활성 자극물만, 자산 URL은 survey-assets 공개 경로", async () => {
    const r = await call("GET", "/api/survey-items");
    expect(r.status).toBe(200);
    const v = SurveyItemsViewSchema.parse(r.body);
    expect(v.items.length).toBeGreaterThan(0);
    for (const it of v.items)
      for (const a of Object.values(it.assets ?? {})) {
        expect(a.url).toContain("/survey-assets/");
        expect(a.url).not.toMatch(/ref-screenshots/);
      }
    expect(r.headers.get("cache-control")).toMatch(/immutable/);
  });
});

describe("6.5.1 익명 세션 · 재개 · 멱등", () => {
  it("쿠키 없이 POST /api/surveys → 201 + anon_id 쿠키(HttpOnly·SameSite=Lax·30일), 1번 문항 pick4", async () => {
    const r = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const sc = r.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/anon_id=[0-9a-f-]{36}/);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(sc).toMatch(/Max-Age=2592000/);
    const v = view(r);
    expect(v.status).toBe("in_progress");
    expect(v.question?.seq).toBe(1);
    expect(v.question?.kind).toBe("pick4");
    expect(v.question?.items).toHaveLength(4);
  });
  it("같은 쿠키로 다시 POST → 200 같은 세션·같은 문항(재개), restart:true → 201 새 세션", async () => {
    const a = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    const va = view(a);
    await call("POST", `/api/surveys/${va.id}/responses`, { body: answerOf(va), cookie: a.cookie });
    const b = await call("POST", "/api/surveys", { body: { entry: "landing" }, cookie: a.cookie });
    expect(b.status).toBe(200);
    const vb = view(b);
    expect(vb.id).toBe(va.id);
    expect(vb.question?.seq).toBe(2);
    const c = await call("POST", "/api/surveys", {
      body: { entry: "landing", restart: true },
      cookie: a.cookie,
    });
    expect(c.status).toBe(201);
    expect(view(c).id).not.toBe(va.id);
  });
  it("같은 seq·같은 본문 재전송은 저장 1건·200, 다른 본문은 409 SEQ_CONFLICT", async () => {
    const a = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    const v = view(a);
    const body = answerOf(v);
    const before = await count("survey_answers");
    for (let i = 0; i < 10; i++) {
      const r = await call("POST", `/api/surveys/${v.id}/responses`, { body, cookie: a.cookie });
      expect(r.status).toBe(200);
    }
    expect(await count("survey_answers")).toBe(before + 1);
    const r = await call("POST", `/api/surveys/${v.id}/responses`, {
      body: { ...answerOf(v, 1), clientTs: body.clientTs },
      cookie: a.cookie,
    });
    expect(r.status).toBe(409);
    expect((r.body.error as { code: string }).code).toBe("SEQ_CONFLICT");
  });
  it("뒤로가기 1회 후 다른 응답이면 벡터 재계산, 연속 뒤로가기는 409 UNDO_NOT_ALLOWED", async () => {
    const a = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    let v = view(a);
    v = view(
      await call("POST", `/api/surveys/${v.id}/responses`, {
        body: answerOf(v, 0),
        cookie: a.cookie,
      }),
    );
    const first = view(
      await call("POST", `/api/surveys/${v.id}/responses`, {
        body: answerOf(v, 0),
        cookie: a.cookie,
      }),
    );
    const u = await call("POST", `/api/surveys/${v.id}/undo`, {
      body: { fromSeq: 3 },
      cookie: a.cookie,
    });
    expect(u.status).toBe(200);
    const back = view(u);
    expect(back.question?.seq).toBe(2);
    expect(back.question?.items).toEqual(v.question?.items);
    expect(back.canUndo).toBe(false);
    const u2 = await call("POST", `/api/surveys/${v.id}/undo`, {
      body: { fromSeq: 2 },
      cookie: a.cookie,
    });
    expect(u2.status).toBe(409);
    expect((u2.body.error as { code: string }).code).toBe("UNDO_NOT_ALLOWED");
    const second = view(
      await call("POST", `/api/surveys/${v.id}/responses`, {
        body: answerOf(back, 3),
        cookie: a.cookie,
      }),
    );
    expect(second.state.mu).not.toEqual(first.state.mu);
  });
});

describe("AC-06-11 · AC-06-12 CSRF·소유", () => {
  it("Origin 불일치 POST → 403 FORBIDDEN_ORIGIN, DB 변경 0", async () => {
    const n = await count("diagnosis_sessions");
    const r = await call("POST", "/api/surveys", {
      body: { entry: "landing" },
      origin: "https://evil.example",
    });
    expect(r.status).toBe(403);
    expect((r.body.error as { code: string }).code).toBe("FORBIDDEN_ORIGIN");
    expect(await count("diagnosis_sessions")).toBe(n);
  });
  it("다른 anon_id로 남의 세션 응답·결과·뒤로가기 → 404", async () => {
    const a = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    const v = view(a);
    const other = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    const c = other.cookie;
    expect(c).not.toBe(a.cookie);
    for (const [m, p, b] of [
      ["POST", `/api/surveys/${v.id}/responses`, answerOf(v)],
      ["GET", `/api/surveys/${v.id}/result`, undefined],
      ["POST", `/api/surveys/${v.id}/undo`, { fromSeq: 1 }],
    ] as const) {
      const r = await call(m, p, { body: b, cookie: c });
      expect(r.status, `${m} ${p}`).toBe(404);
    }
  });
});

describe("완료·결과 · AC-06-46 · 9.4.6 ⑤", () => {
  let surveyId = "";
  let cookie: string | null = null;
  it("완료 전 결과 조회 → 409 SURVEY_NOT_COMPLETED, 끝까지 응답하면 ≤ 16문항에 completed + ResultView", async () => {
    const a = await call("POST", "/api/surveys", { body: { entry: "landing" } });
    cookie = a.cookie;
    let v = view(a);
    surveyId = v.id;
    const early = await call("GET", `/api/surveys/${v.id}/result`, { cookie });
    expect(early.status).toBe(409);
    let n = 0;
    while (v.question) {
      v = view(
        await call("POST", `/api/surveys/${v.id}/responses`, { body: answerOf(v, n), cookie }),
      );
      n++;
      expect(n).toBeLessThanOrEqual(MAXQ);
    }
    expect(v.status).toBe("completed");
    expect(v.resultId).toMatch(/^[0-9a-f-]{36}$/);
    const r = await call("GET", `/api/surveys/${v.id}/result`, { cookie });
    expect(r.status).toBe(200);
    const rv = ResultViewSchema.parse(r.body);
    expect(rv.axes.map((x) => x.key)).toEqual([
      "expression",
      "temperature",
      "shape",
      "density",
      "depth",
    ]);
    expect(TYPES).toContain(rv.type.id);
    expect(rv.adjacentTypes).toHaveLength(2);
    expect(rv.similarSites.length).toBeLessThanOrEqual(TH.diagnosis.similarSites.count);
    expect(new Set(rv.similarSites.map((x) => x.domain)).size).toBe(rv.similarSites.length);
    for (const x of rv.similarSites) expect(x.url).toMatch(/^https:\/\//);
  });
  it("AC-06-46 anchor-override: 2·3순위 밖 400, 허용 유형이면 override만 바뀌고 profile·type_id 바이트 동일", async () => {
    const r = ResultViewSchema.parse(
      (await call("GET", `/api/surveys/${surveyId}/result`, { cookie })).body,
    );
    const allowed = r.adjacentTypes.map((t) => t.id);
    const bad = TYPES.find((t) => t !== r.type.id && !allowed.includes(t))!;
    const x = await call("PATCH", `/api/surveys/${surveyId}/anchor-override`, {
      body: { typeId: bad },
      cookie,
    });
    expect(x.status).toBe(400);
    const snap = async () =>
      (
        await db.withService((tx) =>
          q(tx, "select profile::text as p, type_id from diagnosis_results where session_id = $1", [
            surveyId,
          ]),
        )
      ).rows[0];
    const before = await snap();
    const ok = await call("PATCH", `/api/surveys/${surveyId}/anchor-override`, {
      body: { typeId: allowed[0] },
      cookie,
    });
    expect(ok.status).toBe(200);
    expect(ResultViewSchema.parse(ok.body).anchorOverrideTypeId).toBe(allowed[0]);
    expect(await snap()).toEqual(before);
  });
  it("9.4.6 ⑤ 무작위 응답 사용자 100명 전원 16문항 이내 종료, 오류 0", async () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let u = 0; u < 100; u++) {
      const a = await call("POST", "/api/surveys", { body: { entry: "direct" } });
      expect(a.status).toBe(201);
      let v = view(a);
      let n = 0;
      while (v.question) {
        // 열 칸 중 1칸 cant_tell(A/B만), 1칸 none_of_these(4지선다만), 나머지 무작위 선택
        const roll = Math.floor(rnd() * 10);
        const body =
          roll === 0 && v.question.kind === "ab"
            ? { ...answerOf(v), answer: "cant_tell", chosenItemId: undefined }
            : roll === 1 && v.question.kind === "pick4"
              ? { ...answerOf(v), answer: "none_of_these", chosenItemId: undefined }
              : answerOf(v, Math.floor(rnd() * 4));
        const r = await call("POST", `/api/surveys/${v.id}/responses`, { body, cookie: a.cookie });
        expect(r.status, JSON.stringify(r.body)).toBe(200);
        v = view(r);
        n++;
      }
      expect(n).toBeLessThanOrEqual(MAXQ);
      expect(v.status).toBe("completed");
    }
  });
});

describe("9.4.6 ⑦ 응답 제출 p95(로컬 200요청)", () => {
  it("서버 처리 p95 ≤ perf.surveyServerP95Ms, 관측 p95 ≤ perf.surveyApiP95Ms", async () => {
    const server: number[] = [];
    const total: number[] = [];
    /** 07장 SC-04 측정 조건: 로컬 200요청(합격선 아님). 세션이 끝나면 새 세션으로 이어 간다. */
    const REQUESTS = Array.from({ length: 200 }, (_, i) => i);
    let cookie: string | null = null;
    let v: View | null = null;
    for (const i of REQUESTS) {
      if (!v?.question) {
        const a = await call("POST", "/api/surveys", {
          body: { entry: "direct", restart: true },
          cookie,
        });
        cookie = a.cookie;
        v = view(a);
      }
      const t0 = performance.now();
      const r = await call("POST", `/api/surveys/${v.id}/responses`, {
        body: answerOf(v, i),
        cookie,
      });
      total.push(performance.now() - t0);
      server.push(Number(r.headers.get("server-timing")?.match(/dur=([\d.]+)/)?.[1] ?? NaN));
      v = view(r);
    }
    expect(total).toHaveLength(REQUESTS.length);
    const p95 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * 0.95) - 1]!;
    expect(p95(server)).toBeLessThanOrEqual(PERF.surveyServerP95Ms);
    expect(p95(total)).toBeLessThanOrEqual(PERF.surveyApiP95Ms);
  });
});

describe("AC-02-37 · 9.4.6 ⑥", () => {
  it("한 템플릿 활성 3장 픽스처면 POST /api/surveys → 503 SURVEY_ITEMS_INSUFFICIENT{stage:1, itemKey}", async () => {
    await seedSurveyFixture(db, {
      activeCard: (c) => c.templateId !== "tpl-hero" || ["SV01", "SV02", "SV03"].includes(c.svId),
    });
    try {
      const r = await call("POST", "/api/surveys", { body: { entry: "landing" } });
      expect(r.status).toBe(503);
      const e = r.body.error as { code: string; details: { stage: number; itemKey: string } };
      expect(e.code).toBe("SURVEY_ITEMS_INSUFFICIENT");
      expect(e.details.stage).toBe(1);
      expect(e.details.itemKey).toMatch(/\S/);
    } finally {
      await seedSurveyFixture(db);
    }
  });
  it("⑥ 진단 서버 경로는 LLM·렌더러·워커를 import하지 않는다(정적 그래프)", () => {
    const dir = join(ROOT, "apps/web/src/server");
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n)) files.push(p);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files.filter((p) => /survey|api\.ts$/.test(p))) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/@tastefit\/(llm|renderer|pipeline)|apps\/worker|playwright/);
    }
  });
});
