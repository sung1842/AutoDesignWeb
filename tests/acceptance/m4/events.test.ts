// M4 수용 테스트(5/7): POST /api/events·이벤트 레지스트리·서버 이벤트·identity_links
// (00장 8.2~8.4, AC-00-11·12, 09장 9.4.6 ⑫·T-09). 호출 방식은 ASSUMPTIONS ASM-095·096.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createDbPort, linkIdentity, q, type DbPort } from "../../../packages/db/src/index.js";
import { seedOwnership, seedSurveyFixture } from "../../../packages/db/src/testing/fixtures.js";
import { EVENT_REGISTRY } from "../../../packages/api-contract/src/index.js";
import { handle } from "../../../apps/web/src/server/api.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m4events";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
/** AC-00-11 픽스처 브랜드 값(브랜드 입력 필드에 해당하는 문자열). */
const BRAND = { name: "픽스처브랜드한결테스트", intro: "픽스처 소개 문장 오래 쓰는 물건" };

let db: DbPort;
async function post(path: string, body: unknown, cookie?: string | null) {
  const h = new Headers({ "content-type": "application/json", origin: ORIGIN });
  if (cookie) h.set("cookie", cookie);
  const res = await handle(
    new Request(`${ORIGIN}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) }),
    {
      db,
      webOrigin: ORIGIN,
    },
  );
  const sc = res.headers.get("set-cookie");
  const m = sc ? /anon_id=([^;]+)/.exec(sc) : null;
  const text = await res.text();
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    cookie: m ? `anon_id=${m[1]}` : (cookie ?? null),
  };
}
const ev = (name: string, props: Record<string, unknown>) => ({
  eventId: randomUUID(),
  name,
  sessionId: "tab-1",
  device: "desktop",
  clientTs: new Date().toISOString(),
  props,
});
const rows = async (sql: string, p: unknown[] = []) =>
  (await db.withService((tx) => q(tx, sql, p))).rows;
const nEvents = async () =>
  Number((await rows("select count(*)::int as n from events"))[0]?.n ?? 0);

beforeAll(async () => {
  const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
  expect(up.code, up.out).toBe(0);
  const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
  expect(r.code, r.out).toBe(0);
  const s = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
  expect(s.code, s.out).toBe(0);
  db = createDbPort(DB_URL);
  await seedSurveyFixture(db);
});
afterAll(async () => {
  await db?.close();
});

describe("00장 8.3 레지스트리", () => {
  it("레지스트리는 8.3 표의 이벤트 이름 전부(source 포함)", () => {
    const names = Object.keys(EVENT_REGISTRY);
    for (const n of [
      "landing_view",
      "survey_start",
      "survey_answer",
      "survey_exit",
      "survey_back",
      "survey_complete",
      "result_view",
      "result_rating",
      "result_share",
      "guide_copy",
      "ui_error_shown",
      "mockup_adopted",
    ])
      expect(names, n).toContain(n);
    expect(EVENT_REGISTRY.survey_start.source).toBe("server");
    expect(EVENT_REGISTRY.landing_view.source).toBe("client");
  });
});

describe("POST /api/events · AC-00-12", () => {
  it("등록된 client 이벤트 → 204 + 쿠키 발급, 행 저장(source=client, anon_id = 쿠키)", async () => {
    const r = await post("/api/events", { events: [ev("landing_view", { path: "/" })] });
    expect(r.status).toBe(204);
    expect(r.cookie).toMatch(/^anon_id=[0-9a-f-]{36}$/);
    const got = await rows("select source, anon_id, props from events where name = 'landing_view'");
    expect(got).toHaveLength(1);
    expect(got[0]?.source).toBe("client");
    expect(`anon_id=${String(got[0]?.anon_id)}`).toBe(r.cookie);
  });
  it("같은 eventId 재전송은 저장 1건(on conflict do nothing)", async () => {
    const e = ev("landing_view", { path: "/again" });
    for (const n of ["1회", "2회", "3회"])
      expect((await post("/api/events", { events: [e] })).status, n).toBe(204);
    expect(await rows("select 1 from events where event_id = $1", [e.eventId])).toHaveLength(1);
  });
  it("미등록 이름·props 위반·server 전용 이름·빈 배열·21개 → 400, 저장 0(배치 전체 거부)", async () => {
    const n = await nEvents();
    const bad = [
      { events: [ev("not_registered", {})] },
      { events: [ev("landing_view", { path: 3 })] },
      { events: [ev("result_share", { result_id: randomUUID(), channel: "fax" })] },
      {
        events: [
          ev("survey_start", {
            survey_session_id: randomUUID(),
            entry: "landing",
            is_resume: false,
          }),
        ],
      },
      { events: [ev("landing_view", { path: "/" }), ev("nope", {})] },
      { events: [] },
      { events: Array.from({ length: 21 }, () => ev("landing_view", { path: "/" })) },
    ];
    for (const b of bad) {
      const r = await post("/api/events", b);
      expect(r.status, JSON.stringify(b).slice(0, 120)).toBe(400);
      expect((r.body.error as { code: string }).code).toBe("VALIDATION_FAILED");
    }
    expect(await nEvents()).toBe(n);
  });
});

describe("서버 이벤트(T-09) · AC-00-11", () => {
  it("진단 시작·응답·뒤로가기·완료가 survey_start·survey_answer·survey_back·survey_complete를 남긴다", async () => {
    const a = await post("/api/surveys", { entry: "landing" });
    expect(a.status).toBe(201);
    let v = a.body as {
      id: string;
      question: { seq: number; itemKey: string; items: string[] } | null;
    };
    const id = v.id;
    const answer = () => ({
      seq: v.question!.seq,
      itemKey: v.question!.itemKey,
      shownItemIds: v.question!.items,
      answer: "option",
      chosenItemId: v.question!.items[0],
      latencyMs: 1200,
      clientTs: new Date().toISOString(),
    });
    v = (await post(`/api/surveys/${id}/responses`, answer(), a.cookie)).body as typeof v;
    expect((await post(`/api/surveys/${id}/undo`, { fromSeq: 2 }, a.cookie)).status).toBe(200);
    v = (await post("/api/surveys", { entry: "landing" }, a.cookie)).body as typeof v;
    while (v.question)
      v = (await post(`/api/surveys/${id}/responses`, answer(), a.cookie)).body as typeof v;
    const names = (
      await rows(
        "select name from events where props->>'survey_session_id' = $1 and source = 'server'",
        [id],
      )
    ).map((r) => String(r.name));
    for (const n of ["survey_start", "survey_answer", "survey_back", "survey_complete"])
      expect(names, n).toContain(n);
    const ans = await rows(
      "select props from events where name = 'survey_answer' and props->>'survey_session_id' = $1 order by ts limit 1",
      [id],
    );
    const p = ans[0]?.props as Record<string, unknown>;
    expect(p.answer).toBe("option");
    expect(typeof p.sigma_max_after).toBe("number");
    expect(typeof p.chosen_position).toBe("number");
  });
  it("AC-00-11 events.props 전체에 픽스처 브랜드 값 0건(레지스트리 밖 필드는 거부)", async () => {
    const r = await post("/api/events", {
      events: [ev("landing_view", { path: "/", brand_name: BRAND.name, intro: BRAND.intro })],
    });
    expect(r.status).toBe(400);
    const hit = await rows(
      "select 1 from events where props::text like $1 or props::text like $2",
      [`%${BRAND.name}%`, `%${BRAND.intro}%`],
    );
    expect(hit).toHaveLength(0);
  });
});

describe("00장 8.4 identity_links", () => {
  it("linkIdentity는 (anon_id, user_id) 1행만 넣고 재호출은 무변경, 이벤트 user_id는 갱신하지 않는다", async () => {
    const anon = randomUUID();
    const userId = (await seedOwnership(db)).a;
    await post(
      "/api/events",
      { events: [ev("landing_view", { path: "/link" })] },
      `anon_id=${anon}`,
    );
    await db.withService((tx) => linkIdentity(tx, anon, userId));
    await db.withService((tx) => linkIdentity(tx, anon, userId));
    expect(await rows("select 1 from identity_links where anon_id = $1", [anon])).toHaveLength(1);
    const e = await rows("select user_id from events where anon_id = $1", [anon]);
    expect(e.every((r) => r.user_id === null)).toBe(true);
  });
});
