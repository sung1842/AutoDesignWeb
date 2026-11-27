// M5 수용 테스트(1/7): 인증·귀속·동의(06장 6.5 AC-06-15~18, 01장 AC-01-22·23). native 프로파일 AuthPort local 드라이버.
// 계약: ASSUMPTIONS ASM-103 — 매직링크 요청 = requestMagicLink(서버 함수, S04 서버 액션이 호출), 콜백 = GET /auth/callback?token=&next=,
// 로그아웃 = logout(서버 함수), 세션 쿠키 tf_session. 메일은 dev_mail_outbox를 테스트 픽스처 함수로 읽는다(HTTP 라우트 아님, 6.5.2).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import {
  latestMagicLink,
  seedSimilarSites,
  seedSurveyFixture,
} from "../../../packages/db/src/testing/fixtures.js";
import { createLocalAuth } from "../../../packages/auth/src/index.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { logout, requestMagicLink } from "../../../apps/web/src/server/auth.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5auth";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
let db: DbPort;
let deps: Deps;

interface Res {
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}
/** 쿠키 항아리(이름 → 값). Set-Cookie를 반영한다. */
class Jar {
  m = new Map<string, string>();
  header(): string {
    return [...this.m].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  take(h: Headers): void {
    for (const sc of h.getSetCookie()) {
      const [kv = "", ...attrs] = sc.split(";");
      const [k = "", v = ""] = kv.split("=");
      if (attrs.some((a) => /max-age=0/i.test(a.trim()))) this.m.delete(k.trim());
      else this.m.set(k.trim(), v.trim());
    }
  }
}
async function call(jar: Jar, method: string, path: string, body?: unknown): Promise<Res> {
  const h = new Headers({ origin: ORIGIN });
  if (body !== undefined || method !== "GET") h.set("content-type", "application/json");
  if (jar.m.size) h.set("cookie", jar.header());
  const res = await handle(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: h,
      redirect: "manual",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    deps,
  );
  jar.take(res.headers);
  const text = await res.text();
  return {
    status: res.status,
    body: text && text.startsWith("{") ? (JSON.parse(text) as Record<string, unknown>) : {},
    headers: res.headers,
  };
}
type View = { id: string; question: { seq: number; itemKey: string; items: string[] } | null };
async function completeSurvey(jar: Jar): Promise<string> {
  let v = (await call(jar, "POST", "/api/surveys", { entry: "landing" })).body as unknown as View;
  const id = v.id;
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
  return id;
}
/** 매직링크 요청 → outbox 링크 → 콜백. 302 Location을 돌려준다. */
async function login(jar: Jar, email: string, next = "/me"): Promise<string> {
  await requestMagicLink(deps, { email, next, turnstileToken: "local-ok" });
  const link = new URL(await latestMagicLink(db, email));
  expect(link.pathname).toBe("/auth/callback");
  const r = await call(jar, "GET", `${link.pathname}${link.search}`);
  expect(r.status, JSON.stringify(r.body)).toBe(302);
  return r.headers.get("location") ?? "";
}
const email = () => `u-${randomBytes(4).toString("hex")}@example.com`;
const consentAll = (jar: Jar) =>
  call(jar, "POST", "/api/consents", {
    items: ["age_14", "terms", "privacy_notice"].map((docType) => ({
      docType,
      docVersion: "2026-11-16",
      agreed: true,
    })),
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
  deps = {
    db,
    webOrigin: ORIGIN,
    auth: createLocalAuth({ db, secret: randomBytes(32).toString("base64url"), webOrigin: ORIGIN }),
  };
});
afterAll(async () => {
  await db?.close();
});

describe("AC-06-15 · AC-06-18 익명 진단 → 매직링크 로그인 → 귀속", () => {
  it("AC-06-15 완료 세션 user_id 채움, identity_links 1행, login_success.merged_anon=true", async () => {
    const jar = new Jar();
    const sid = await completeSurvey(jar);
    const anon = jar.m.get("anon_id");
    const addr = email();
    await login(jar, addr);
    expect(jar.m.get("tf_session")).toMatch(/\S/);
    const me = await call(jar, "GET", "/api/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(addr);
    const uid = String(me.body.id);
    const s = (
      await db.withService((tx) =>
        q(tx, "select user_id from diagnosis_sessions where id = $1", [sid]),
      )
    ).rows[0];
    expect(s?.user_id).toBe(uid);
    const links = await db.withService((tx) =>
      q(tx, "select 1 from identity_links where anon_id = $1 and user_id = $2", [anon, uid]),
    );
    expect(links.rowCount).toBe(1);
    const ev = await db.withService((tx) =>
      q(tx, "select props from events where name = 'login_success' and user_id = $1", [uid]),
    );
    expect((ev.rows[0]?.props as { merged_anon: boolean }).merged_anon).toBe(true);
  });
  it("AC-06-18 anon_id 쿠키 HttpOnly·Secure·SameSite=Lax·Max-Age=2592000, 세션 쿠키 HttpOnly·Secure·SameSite=Lax", async () => {
    const jar = new Jar();
    const r = await call(jar, "POST", "/api/surveys", { entry: "landing" });
    const anon = r.headers.getSetCookie().find((c) => c.startsWith("anon_id="))!;
    for (const a of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=2592000"])
      expect(anon).toContain(a);
    const addr = email();
    await requestMagicLink(deps, { email: addr, next: "/me", turnstileToken: "local-ok" });
    const link = new URL(await latestMagicLink(db, addr));
    const cb = await call(jar, "GET", `${link.pathname}${link.search}`);
    const sess = cb.headers.getSetCookie().find((c) => c.startsWith("tf_session="))!;
    for (const a of ["HttpOnly", "Secure", "SameSite=Lax"]) expect(sess).toContain(a);
  });
  it("AC-06-15 매직링크는 1회용: 같은 링크 재사용은 세션을 만들지 않는다", async () => {
    const addr = email();
    await requestMagicLink(deps, { email: addr, next: "/me", turnstileToken: "local-ok" });
    const link = new URL(await latestMagicLink(db, addr));
    const a = new Jar();
    expect((await call(a, "GET", `${link.pathname}${link.search}`)).status).toBe(302);
    const b = new Jar();
    const again = await call(b, "GET", `${link.pathname}${link.search}`);
    expect(b.m.get("tf_session")).toBeUndefined();
    expect(again.headers.get("location") ?? "").toContain("/login?error=");
  });
});

describe("AC-06-16 로그아웃", () => {
  it("AC-06-16 로그아웃 후 새 익명 진단 세션은 user_id null, anon_id가 로그아웃 전과 다르다", async () => {
    const jar = new Jar();
    await completeSurvey(jar);
    const before = jar.m.get("anon_id");
    await login(jar, email());
    const cookies = await logout(
      deps,
      new Request(`${ORIGIN}/`, { headers: { cookie: jar.header() } }),
    );
    jar.take(cookies);
    expect(jar.m.get("tf_session")).toBeUndefined();
    expect((await call(jar, "GET", "/api/me")).status).toBe(401);
    const sid = (await call(jar, "POST", "/api/surveys", { entry: "landing" })).body.id as string;
    expect(jar.m.get("anon_id")).not.toBe(before);
    const s = (
      await db.withService((tx) =>
        q(tx, "select user_id from diagnosis_sessions where id = $1", [sid]),
      )
    ).rows[0];
    expect(s?.user_id).toBeNull();
  });
});

describe("AC-01-22 · AC-01-23 콜백 next·첫 동의", () => {
  it("AC-01-22 next=https://evil.example → /me, 첫 로그인은 /onboarding/consent?next=… 를 거친다", async () => {
    const first = new Jar();
    const loc1 = await login(first, email(), "/brief?result=x");
    expect(loc1).toMatch(/^\/onboarding\/consent\?next=/);
    expect(decodeURIComponent(loc1.split("next=")[1] ?? "")).toBe("/brief?result=x");
    await consentAll(first);
    const again = new Jar();
    const addr = email();
    await login(again, addr);
    await consentAll(again);
    const loc2 = await login(again, addr, "https://evil.example/steal");
    expect(loc2).toBe("/me");
  });
  it("AC-01-23 C1(age_14)·C2(terms) 없이 POST /api/consents → 400, 완료 시 age_14·terms·privacy_notice 3행", async () => {
    const jar = new Jar();
    await login(jar, email());
    const bad = await call(jar, "POST", "/api/consents", {
      items: [{ docType: "privacy_notice", docVersion: "2026-11-16", agreed: true }],
    });
    expect(bad.status).toBe(400);
    expect((await consentAll(jar)).status).toBe(204);
    const me = await call(jar, "GET", "/api/me");
    expect(me.body.consentsOk).toBe(true);
    const rows = await db.withService((tx) =>
      q(tx, "select doc_type from consents where user_id = $1 order by doc_type", [me.body.id]),
    );
    expect(rows.rows.map((r) => r.doc_type)).toEqual(["age_14", "privacy_notice", "terms"]);
  });
  it("AC-01-22 동의 전 /api/me consentsOk=false, 비로그인 /api/me → 401", async () => {
    const jar = new Jar();
    expect((await call(jar, "GET", "/api/me")).status).toBe(401);
    await login(jar, email());
    const me = await call(jar, "GET", "/api/me");
    expect(me.body.consentsOk).toBe(false);
  });
});
