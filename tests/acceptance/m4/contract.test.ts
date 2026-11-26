// M4 수용 테스트: API 계약(06장 AC-06-08). 레지스트리 = 6.4.3 표 51개, 빌드된 라우트(Next app-paths-manifest, 없으면 app/api 파일)마다
// 요청·응답 스키마가 있고 정상 1건 + 오류 1건 이상을 검증한다. 호출은 handle in-process(ASM-095·102).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createDbPort, type DbPort } from "../../../packages/db/src/index.js";
import { seedSimilarSites, seedSurveyFixture } from "../../../packages/db/src/testing/fixtures.js";
import {
  ErrorBodySchema,
  LOCAL_ONLY_ROUTES,
  ROUTES,
} from "../../../packages/api-contract/src/index.js";
import { handle } from "../../../apps/web/src/server/api.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m4contract";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const APP = join(ROOT, "apps/web/src/app");
let db: DbPort;

/** FINAL 06장 6.4.3 엔드포인트 표의 "METHOD /path"(쿼리 제거). */
function specRoutes(): string[] {
  const t = readFileSync(join(ROOT, "docs/spec/FINAL/06_architecture.md"), "utf8").split("\n");
  const a = t.findIndex((l) => l.startsWith("### 6.4.3"));
  const b = t.findIndex((l, i) => i > a && l.startsWith("### 6.4.4"));
  return t.slice(a, b).flatMap((l) => {
    const m = /^\| `(GET|POST|PATCH|PUT|DELETE) ([^`?]+)/.exec(l);
    return m ? [`${m[1]} ${m[2]!.trim()}`] : [];
  });
}
/** 빌드 매니페스트(또는 app/api 파일)의 라우트 × route.ts가 내보내는 메서드. */
function builtRoutes(): string[] {
  const man = join(ROOT, "apps/web/.next/server/app-paths-manifest.json");
  const dirs = existsSync(man)
    ? Object.keys(JSON.parse(readFileSync(man, "utf8")) as Record<string, string>)
        .filter((k) => k.endsWith("/route"))
        .map((k) => k.replace(/\/route$/, ""))
    : (() => {
        const out: string[] = [];
        const walk = (d: string): void => {
          for (const n of readdirSync(d)) {
            const p = join(d, n);
            if (statSync(p).isDirectory()) walk(p);
            else if (n === "route.ts") out.push(`/${relative(APP, d)}`.replace("%5F", "_"));
          }
        };
        walk(join(APP, "api"));
        return out;
      })();
  return dirs
    .filter((d) => !(LOCAL_ONLY_ROUTES as readonly string[]).includes(d))
    .flatMap((d) => {
      const file = join(APP, d.replace("/_storage", "/%5Fstorage"), "route.ts");
      const src = readFileSync(file, "utf8");
      const path = d.replace(/\[([^\]]+)\]/g, ":$1");
      return [
        ...src.matchAll(/export (?:const|async function) (GET|POST|PATCH|PUT|DELETE)\b/g),
      ].map((m) => `${m[1]} ${path}`);
    });
}

async function call(method: string, path: string, body?: unknown, cookie?: string | null) {
  const h = new Headers({ origin: ORIGIN });
  if (body !== undefined || method !== "GET") h.set("content-type", "application/json");
  if (cookie) h.set("cookie", cookie);
  const res = await handle(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: h,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    { db, webOrigin: ORIGIN },
  );
  const text = await res.text();
  const sc = res.headers.get("set-cookie");
  const m = sc ? /anon_id=([^;]+)/.exec(sc) : null;
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as unknown) : null,
    cookie: m ? `anon_id=${m[1]}` : (cookie ?? null),
  };
}
type View = {
  id: string;
  question: { seq: number; itemKey: string; items: string[] } | null;
  resultId: string | null;
};
const answer = (v: View) => ({
  seq: v.question!.seq,
  itemKey: v.question!.itemKey,
  shownItemIds: v.question!.items,
  answer: "option",
  chosenItemId: v.question!.items[0],
  latencyMs: 1200,
  clientTs: new Date().toISOString(),
});

interface Case {
  ok: { status: number; run: () => Promise<{ status: number; body: unknown }> };
  err: { status: number; run: () => Promise<{ status: number; body: unknown }> };
}
/** 라우트별 정상·오류 사례(세션 상태가 필요한 것은 실행 시 만든다). */
function cases(): Record<string, Case> {
  const fresh = async () => {
    const a = await call("POST", "/api/surveys", { entry: "direct" });
    return { v: a.body as View, cookie: a.cookie };
  };
  const done = async () => {
    const s = await fresh();
    let v = s.v;
    while (v.question)
      v = (await call("POST", `/api/surveys/${v.id}/responses`, answer(v), s.cookie)).body as View;
    return { v, cookie: s.cookie };
  };
  const missing = "00000000-0000-4000-8000-000000000000";
  return {
    "GET /api/survey-items": {
      ok: { status: 200, run: () => call("GET", "/api/survey-items") },
      err: { status: 404, run: () => call("GET", "/api/survey-items?taxonomyVersion=1999-S1") },
    },
    "POST /api/surveys": {
      ok: { status: 201, run: () => call("POST", "/api/surveys", { entry: "landing" }) },
      err: { status: 400, run: () => call("POST", "/api/surveys", { entry: "nowhere" }) },
    },
    "GET /api/surveys/current": {
      ok: {
        status: 200,
        run: async () => call("GET", "/api/surveys/current", undefined, (await fresh()).cookie),
      },
      err: { status: 404, run: () => call("GET", "/api/surveys/current") },
    },
    "POST /api/surveys/:id/responses": {
      ok: {
        status: 200,
        run: async () => {
          const s = await fresh();
          return call("POST", `/api/surveys/${s.v.id}/responses`, answer(s.v), s.cookie);
        },
      },
      err: {
        status: 409,
        run: async () => {
          const s = await fresh();
          return call(
            "POST",
            `/api/surveys/${s.v.id}/responses`,
            { ...answer(s.v), seq: 5 },
            s.cookie,
          );
        },
      },
    },
    "POST /api/surveys/:id/undo": {
      ok: {
        status: 200,
        run: async () => {
          const s = await fresh();
          const v = (await call("POST", `/api/surveys/${s.v.id}/responses`, answer(s.v), s.cookie))
            .body as View;
          return call("POST", `/api/surveys/${v.id}/undo`, { fromSeq: 2 }, s.cookie);
        },
      },
      err: {
        status: 409,
        run: async () => {
          const s = await fresh();
          return call("POST", `/api/surveys/${s.v.id}/undo`, { fromSeq: 1 }, s.cookie);
        },
      },
    },
    "GET /api/surveys/:id/result": {
      ok: {
        status: 200,
        run: async () => {
          const s = await done();
          return call("GET", `/api/surveys/${s.v.id}/result`, undefined, s.cookie);
        },
      },
      err: {
        status: 409,
        run: async () => {
          const s = await fresh();
          return call("GET", `/api/surveys/${s.v.id}/result`, undefined, s.cookie);
        },
      },
    },
    "POST /api/surveys/:id/rating": {
      ok: {
        status: 200,
        run: async () => {
          const s = await done();
          return call("POST", `/api/surveys/${s.v.id}/rating`, { score: 2 }, s.cookie);
        },
      },
      err: {
        status: 400,
        run: async () => {
          const s = await done();
          return call("POST", `/api/surveys/${s.v.id}/rating`, { score: 9 }, s.cookie);
        },
      },
    },
    "PATCH /api/surveys/:id/anchor-override": {
      ok: {
        status: 200,
        run: async () => {
          const s = await done();
          return call(
            "PATCH",
            `/api/surveys/${s.v.id}/anchor-override`,
            { typeId: null },
            s.cookie,
          );
        },
      },
      err: {
        status: 404,
        run: () => call("PATCH", `/api/surveys/${missing}/anchor-override`, { typeId: null }),
      },
    },
    "DELETE /api/surveys/:id": {
      ok: {
        status: 204,
        run: async () => {
          const s = await fresh();
          return call("DELETE", `/api/surveys/${s.v.id}`, undefined, s.cookie);
        },
      },
      err: { status: 404, run: () => call("DELETE", `/api/surveys/${missing}`) },
    },
    "POST /api/events": {
      ok: {
        status: 204,
        run: () =>
          call("POST", "/api/events", {
            events: [
              {
                eventId: crypto.randomUUID(),
                name: "landing_view",
                sessionId: "t",
                device: "desktop",
                clientTs: new Date().toISOString(),
                props: { path: "/" },
              },
            ],
          }),
      },
      err: { status: 400, run: () => call("POST", "/api/events", { events: [] }) },
    },
  };
}

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
});
afterAll(async () => {
  await db?.close();
});

describe("AC-06-08 API 계약", () => {
  it("AC-06-08 ① api-contract 레지스트리 = 06장 6.4.3 라우트 51개(누락·추가 0)", () => {
    const spec = specRoutes();
    expect(spec).toHaveLength(51);
    expect(Object.keys(ROUTES).sort()).toEqual([...spec].sort());
  });
  it("AC-06-08 ② 빌드된 라우트마다 레지스트리 응답 스키마(본문 메서드는 요청 스키마)와 정상·오류 사례가 있다", () => {
    const built = builtRoutes();
    expect(built.length).toBeGreaterThan(0);
    const cs = cases();
    for (const r of built) {
      const c = ROUTES[r];
      expect(c, `${r} 레지스트리`).toBeDefined();
      expect(c?.res, `${r} 응답 스키마`).toBeDefined();
      if (/^(POST|PATCH|PUT) /.test(r)) expect(c?.req, `${r} 요청 스키마`).toBeDefined();
      if (r !== "GET /api/health") expect(cs[r], `${r} 계약 사례`).toBeDefined();
    }
  });
  it("AC-06-08 ③ 라우트별 정상 1건(응답 스키마 parse) + 오류 1건(ErrorBody parse)", async () => {
    for (const [r, c] of Object.entries(cases())) {
      const ok = await c.ok.run();
      expect(ok.status, `${r} 정상 ${JSON.stringify(ok.body).slice(0, 200)}`).toBe(c.ok.status);
      const res = ROUTES[r]!.res!;
      expect(res.safeParse(ok.body).success, `${r} 응답 스키마`).toBe(true);
      const err = await c.err.run();
      expect(err.status, `${r} 오류`).toBe(c.err.status);
      expect(ErrorBodySchema.safeParse(err.body).success, `${r} ErrorBody`).toBe(true);
    }
  });
  it("AC-06-08 ④ GET /api/health 정상 응답 스키마, 다른 메서드는 내보내지 않음(프레임워크 405)", async () => {
    Object.assign(process.env, {
      APP_ENV: "local",
      STACK_PROFILE: "native",
      AUTH_DRIVER: "local",
      STORAGE_DRIVER: "fs",
      MAIL_DRIVER: "local",
      TURNSTILE_DRIVER: "local",
      LLM_MODE: "mock",
      WEB_ORIGIN: ORIGIN,
      PREVIEW_ORIGIN: "http://127.0.0.1:3001",
      DATABASE_URL_DIRECT: DB_URL,
      DATABASE_URL_POOLED: DB_URL,
      LOCAL_JWT_SECRET: randomBytes(32).toString("base64url"),
      PREVIEW_SIGNING_SECRET: randomBytes(32).toString("base64url"),
      IP_HMAC_KEY: randomBytes(32).toString("base64url"),
      CONSENT_HASH_KEY: randomBytes(32).toString("base64url"),
      ADMIN_EMAILS: "admin@example.com",
    });
    const mod = (await import("../../../apps/web/src/app/api/health/route.js")) as Record<
      string,
      unknown
    >;
    const res = await (mod.GET as () => Promise<Response>)();
    expect([200, 503]).toContain(res.status);
    expect(ROUTES["GET /api/health"]!.res!.safeParse(await res.json()).success).toBe(true);
    expect(Object.keys(mod).filter((k) => /^(POST|PATCH|PUT|DELETE)$/.test(k))).toEqual([]);
  });
});
