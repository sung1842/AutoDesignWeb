// M5 수용 테스트(12): 데이터 접근 단일 경로(06장 6.13, AC-06-59 ①~⑦). native 프로파일 기준. 계약: ASSUMPTIONS ASM-119.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import {
  latestMagicLink,
  seedSimilarSites,
  seedSurveyFixture,
} from "../../../packages/db/src/testing/fixtures.js";
import { createLocalAuth } from "../../../packages/auth/src/index.js";
import { createFsStorage } from "../../../packages/storage/src/index.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { requestMagicLink } from "../../../apps/web/src/server/auth.js";
import { handlePreview } from "../../../apps/web/src/lib/preview.js";
import { Jar } from "../_support/pipe.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5access";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const PREVIEW = "http://127.0.0.1:3001";
const SCAN = ["apps/web", "apps/worker", "packages"];
const SKIP_DIR = new Set(["node_modules", "dist", ".next", ".turbo", "coverage"]);
const SUPABASE_ONLY = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL_POOLED",
];

function files(dir: string, keep: (f: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const n of readdirSync(d)) {
      if (SKIP_DIR.has(n)) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (keep(p)) out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}
const src = (): string[] =>
  SCAN.flatMap((d) => files(join(ROOT, d), (f) => /\.(ts|tsx|mts|js|mjs)$/.test(f))).filter(
    (f) => !/\.test\.tsx?$/.test(f),
  );
const rel = (f: string) => relative(ROOT, f);
const supabaseDriver = (f: string) => /packages\/[^/]+\/src\/drivers\/supabase/.test(rel(f));

let db: DbPort;
let deps: Deps;
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
  // 자산 경로를 survey:build 산출(manifest.lock)로 바꿔 실제 WebP를 쓴다(e2e/serve.ts와 같은 방식, ASM-119)
  const man = join(ROOT, "data/survey/manifest.lock.json");
  const items = (
    JSON.parse(readFileSync(man, "utf8")) as { items: { assetId: string; assets: unknown }[] }
  ).items;
  await db.withService(async (tx) => {
    for (const i of items)
      if (i.assets)
        await q(tx, "update survey_items set assets = $2 where id = $1", [
          i.assetId,
          JSON.stringify(i.assets),
        ]);
  });
  const secret = randomBytes(32).toString("base64url");
  deps = {
    db,
    webOrigin: ORIGIN,
    storage: createFsStorage({ webOrigin: ORIGIN, secret }),
    auth: createLocalAuth({ db, secret: randomBytes(32).toString("base64url"), webOrigin: ORIGIN }),
  };
});
afterAll(async () => {
  await db?.close();
});
async function call(jar: Jar, method: string, path: string, body?: unknown) {
  const h = new Headers({ origin: ORIGIN });
  if (method !== "GET") h.set("content-type", "application/json");
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
  return res;
}

describe("AC-06-59 데이터 접근 단일 경로", () => {
  it("AC-06-59 ① 브라우저 번들 @supabase 0, 쿼리 빌더 .from('표')·.rpc( 0, supabase-js import는 supabase 드라이버 밖 0, pg·kysely import는 packages/db 밖 0", () => {
    const fs = src();
    expect(fs.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const f of fs) {
      const t = readFileSync(f, "utf8");
      const r = rel(f);
      if (!supabaseDriver(f)) {
        for (const l of t.split("\n")) {
          if (/\.rpc\(/.test(l)) bad.push(`${r}: .rpc(`);
          if (
            /(?<!\b(?:Array|Buffer|Uint8Array|Object|Set|Map))\.from\(\s*['"`][a-z_]+['"`]\s*\)/.test(
              l,
            )
          )
            bad.push(`${r}: .from(table)`);
        }
        if (
          /from\s+["']@supabase\/supabase-js["']|require\(["']@supabase\/supabase-js["']\)/.test(t)
        )
          bad.push(`${r}: supabase-js import`);
      }
      if (!r.startsWith("packages/db/") && /from\s+["'](pg|kysely)(\/[^"']*)?["']/.test(t))
        bad.push(`${r}: pg/kysely import`);
    }
    expect(bad).toEqual([]);
    const stat = join(ROOT, "apps/web/.next/static");
    const bundles = files(stat, (f) => f.endsWith(".js"));
    for (const b of bundles) expect(readFileSync(b, "utf8"), rel(b)).not.toContain("@supabase/");
  });
  it("AC-06-59 ② native에서 db:types가 Docker 없이 types.gen.ts를 만들고 web·worker가 컴파일된다", async () => {
    const t = await run("pnpm", ["-s", "db:types"], ROOT, {
      ...ENV,
      DOCKER_HOST: "unix:///nonexistent",
    });
    expect(t.code, t.out).toBe(0);
    expect(
      files(join(ROOT, "packages/db"), (f) => f.endsWith("types.gen.ts")).length,
    ).toBeGreaterThan(0);
    for (const app of ["web", "worker"]) {
      const c = await run("pnpm", ["-s", "--filter", `./apps/${app}`, "run", "typecheck"], ROOT);
      expect(c.code, `${app} ${c.out.slice(-2000)}`).toBe(0);
    }
  });
  it("AC-06-59 ③ GET /api/survey-items의 assets.desktop.url → 200 image/webp", async () => {
    const jar = new Jar();
    const r = await call(jar, "GET", "/api/survey-items");
    expect(r.status).toBe(200);
    const body = (await r.json()) as { items?: { assets?: { desktop?: { url?: string } } }[] };
    const url = body.items?.find((i) => i.assets?.desktop?.url)?.assets?.desktop?.url;
    expect(url, "desktop url").toBeTruthy();
    const u = new URL(String(url), ORIGIN);
    const img = await call(jar, "GET", `${u.pathname}${u.search}`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/webp");
  });
  it("AC-06-59 ④ AuthPort.adminSignOutAll 이전 세션 쿠키로 /api/me → 401, adminDeleteUser 후 auth.users 0행", async () => {
    const jar = new Jar();
    const email = `acc-${randomBytes(4).toString("hex")}@example.com`;
    await requestMagicLink(deps, { email, next: "/me", turnstileToken: "local-ok" });
    const link = new URL(await latestMagicLink(db, email));
    await call(jar, "GET", `${link.pathname}${link.search}`);
    const me = await call(jar, "GET", "/api/me");
    expect(me.status).toBe(200);
    const uid = String(
      ((await me.json()) as { user?: { id?: string }; id?: string }).user?.id ?? "",
    );
    const ids = await db.withService((tx) =>
      q(tx, "select id from auth.users where email = $1", [email]),
    );
    const id = uid || String(ids.rows[0]?.id ?? "");
    expect(id).not.toBe("");
    await deps.auth.adminSignOutAll(id);
    expect((await call(jar, "GET", "/api/me")).status).toBe(401);
    await deps.auth.adminDeleteUser(id);
    const left = await db.withService((tx) =>
      q(tx, "select count(*)::int as n from auth.users where id = $1", [id]),
    );
    expect(left.rows[0]?.n).toBe(0);
  });
  it("AC-06-59 ⑤ native에서 supabase 전용 변수를 비워도 기동, APP_ENV=staging에서 하나라도 비우면 종료 코드 1", async () => {
    const empty = Object.fromEntries(SUPABASE_ONLY.map((k) => [k, ""]));
    for (const app of ["web", "worker"]) {
      const ok = await run(
        "pnpm",
        ["-s", "--filter", `./apps/${app}`, "run", "start:check-env"],
        ROOT,
        {
          ...empty,
          APP_ENV: "local",
          STACK_PROFILE: "native",
        },
      );
      expect(ok.code, `${app} native ${ok.out}`).toBe(0);
    }
    const full = Object.fromEntries(
      SUPABASE_ONLY.map((k) => [
        k,
        k === "SUPABASE_URL" ? "https://x.supabase.co" : k === "DATABASE_URL_POOLED" ? DB_URL : "k",
      ]),
    );
    for (const k of SUPABASE_ONLY) {
      const r = await run(
        "pnpm",
        ["-s", "--filter", "./apps/web", "run", "start:check-env"],
        ROOT,
        {
          ...full,
          [k]: "",
          APP_ENV: "staging",
          STACK_PROFILE: "supabase",
        },
      );
      expect(r.code, `staging ${k} 비움 ${r.out}`).toBe(1);
    }
  });
  it("AC-06-59 ⑥ APP_ENV=prod에서 /api/_storage/* → 404, 미리보기 오리진 /healthz → 200", async () => {
    const prev = process.env.APP_ENV;
    process.env.APP_ENV = "prod";
    try {
      const r = await call(new Jar(), "GET", "/api/_storage/public/survey/x.webp");
      expect(r.status).toBe(404);
    } finally {
      if (prev === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = prev;
    }
    const h = await handlePreview(new Request(`${PREVIEW}/healthz`), {
      env: {
        WEB_ORIGIN: ORIGIN,
        PREVIEW_ORIGIN: PREVIEW,
        PREVIEW_SIGNING_SECRET: randomBytes(32).toString("base64url"),
        APP_ENV: "local",
      },
      now: () => Date.now(),
      loadCandidate: () => Promise.resolve(null),
      data: null,
    });
    expect(h.status).toBe(200);
  });
  it("AC-06-59 ⑦ NEXT_PUBLIC_SUPABASE 문자열이 코드·.env.example에 0건", () => {
    const hits = [...src(), join(ROOT, ".env.example")].filter((f) =>
      readFileSync(f, "utf8").includes("NEXT_PUBLIC_SUPABASE"),
    );
    expect(hits.map(rel)).toEqual([]);
  });
});
