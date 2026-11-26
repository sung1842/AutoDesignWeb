// M5 수용 테스트(7/7): 남용·보안·운영 가드(08장 AC-08-24·26·41c·42, 04장 AC-04-38 ①, 06장 AC-06-52(정적·기동)·AC-06-60,
// 07장 AC-07-13, 09장 AC-09-13). 계약: ASSUMPTIONS ASM-113.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import {
  latestMagicLink,
  seedSimilarSites,
  seedSurveyFixture,
} from "../../../packages/db/src/testing/fixtures.js";
import { createLocalAuth } from "../../../packages/auth/src/index.js";
import { buildFallback, loadDesignData } from "../../../packages/design-spec/src/index.js";
import { compilePage } from "../../../packages/renderer/src/index.js";
import { termsBlocks } from "../../../apps/web/src/lib/terms.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { requestMagicLink } from "../../../apps/web/src/server/auth.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5sec";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const HASH_KEY = randomBytes(32).toString("base64url");
const ADMIN = "boss@example.com";
let db: DbPort;
let deps: Deps;

class Jar {
  m = new Map<string, string>();
  header(): string {
    return [...this.m].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  take(h: Headers): void {
    for (const sc of h.getSetCookie()) {
      const [kv = ""] = sc.split(";");
      const [k = "", v = ""] = kv.split("=");
      this.m.set(k.trim(), v.trim());
    }
  }
}
async function call(
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const h = new Headers({ origin: ORIGIN, ...extra });
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
async function survey(jar: Jar): Promise<string> {
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
  return v.resultId ?? "";
}
async function login(jar: Jar, email: string): Promise<void> {
  await requestMagicLink(deps, { email, next: "/me", turnstileToken: "local-ok" });
  const link = new URL(await latestMagicLink(db, email));
  await call(jar, "GET", `${link.pathname}${link.search}`);
}
const rows = async (sql: string, p: unknown[] = []) =>
  (await db.withService((tx) => q(tx, sql, p))).rows;
const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
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
    adminEmails: ADMIN,
    consentHashKey: HASH_KEY,
    auth: createLocalAuth({ db, secret: randomBytes(32).toString("base64url"), webOrigin: ORIGIN }),
  };
});
afterAll(async () => {
  await db?.close();
});

describe("08장 AC-08-24 · 04장 AC-04-38 few-shot 저장 조건(DB CHECK)", () => {
  it("AC-08-24 · AC-04-38 origin≠operator·approved_by null INSERT는 DB가 거부, operator 행은 저장", async () => {
    const tv = String(
      (await rows("select version from taxonomy_releases where status = 'active' limit 1"))[0]
        ?.version,
    );
    const ins = (origin: string, approvedBy: string | null) =>
      db.withService((tx) =>
        q(
          tx,
          `insert into fewshot_examples (origin, consent_id, approved_by, approved_at, type_id, purpose, pattern_id, taxonomy_version, layout_tree, tokens, active)
           values ($1, null, $2, now(), 'T1', 'saas', 'PS-1', $3, '{}', '{}', false)`,
          [origin, approvedBy, tv],
        ),
      );
    await expect(ins("user_consented", "op")).rejects.toThrow();
    await expect(ins("operator", null)).rejects.toThrow();
    await expect(ins("operator", "op")).resolves.toBeTruthy();
  });
});

describe("08장 AC-08-41c 금지 업종", () => {
  it("AC-08-41c 금지 범주 6 × 양성 5(활용형·띄어쓰기) 차단 100%(422 BLOCKED_BRAND·prohibited_category), 일반 브리프 50 오탐 0", async () => {
    const f = JSON.parse(readFileSync(join(ROOT, "fixtures/brands/prohibited.json"), "utf8")) as {
      items: { category: string; description: string }[];
    };
    const cats = new Set(f.items.map((x) => x.category));
    expect(cats.size).toBe(6);
    for (const c of cats) expect(f.items.filter((x) => x.category === c)).toHaveLength(5);
    const jar = new Jar();
    const resultId = await survey(jar);
    const draft = (brand: Record<string, unknown>) =>
      call(jar, "POST", "/api/brief-drafts", {
        resultId,
        purpose: "local_business",
        brand,
        useSampleContent: false,
      });
    for (const it of f.items) {
      const r = await draft({
        name: "새 가게",
        description: it.description,
        primaryAction: "visit",
      });
      const e = r.body.error as { code?: string; details?: { reason?: string } } | undefined;
      expect([r.status, e?.code, e?.details?.reason], it.description).toEqual([
        422,
        "BLOCKED_BRAND",
        "prohibited_category",
      ]);
    }
    const normal = (
      JSON.parse(readFileSync(join(ROOT, "fixtures/brands/high-risk.json"), "utf8")) as {
        normal: string[];
      }
    ).normal;
    expect(normal).toHaveLength(50);
    for (const name of normal) {
      const r = await draft({
        name,
        description: "동네에서 오래 사랑받는 작은 가게입니다",
        primaryAction: "visit",
      });
      expect(r.status, name).toBe(201);
    }
  });
});

describe("08장 AC-08-42 컴파일러 산출물 정적 검사", () => {
  it('AC-08-42 픽스처 트리 전부 컴파일 산출물에 type="password"·action=·javascript: 0건', () => {
    const data = loadDesignData(ROOT);
    const dir = join(ROOT, "fixtures/layouts");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    // 픽스처는 원시 트리(raw)라 표준 명세와 함께 확정 트리를 만드는 폴백 경로로 컴파일한다
    for (const f of files) {
      const fx = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
        purpose: string;
        typeId: string;
      };
      for (const v of ["v_true", "v_fit", "v_bal"] as const) {
        const { spec, tree } = buildFallback(
          { typeId: fx.typeId, purpose: fx.purpose, variant: v },
          data,
        );
        const { html } = compilePage(spec, tree, data);
        for (const bad of [/type\s*=\s*["']?password/i, /\saction\s*=/i, /javascript:/i])
          expect(bad.test(html), `${f}/${v} ${String(bad)}`).toBe(false);
      }
    }
  });
});

describe("08장 AC-08-26 이용약관 생성 결과물 조항", () => {
  it("AC-08-26 /terms 원문(legal/terms.md)에 제○조(생성 결과물) 헤딩과 ①~⑥ 문구가 순서대로 있다", () => {
    const blocks = termsBlocks(readFileSync(join(ROOT, "legal/terms.md"), "utf8"));
    const h = blocks.findIndex((b) => b.kind === "h2" && b.text === "제○조(생성 결과물)");
    expect(h).not.toBe(-1);
    const after = blocks
      .slice(h + 1)
      .filter((b) => b.kind === "p")
      .map((b) => b.text[0]);
    for (const n of ["①", "②", "③", "④", "⑤", "⑥"]) expect(after).toContain(n);
    expect(readFileSync(join(ROOT, "apps/web/src/app/terms/page.tsx"), "utf8")).toContain(
      "legal/terms.md",
    );
  });
});

describe("기동·라우트 가드(AC-09-13 · AC-06-52 · AC-07-13)", () => {
  const boot = (app: "web" | "worker", env: Record<string, string>) =>
    run("pnpm", ["-s", "--filter", `./apps/${app}`, "run", "start:check-env"], ROOT, env);
  it("AC-09-13 NODE_ENV=production ∧ LLM_MODE≠live → web·worker 기동 종료 코드 1", async () => {
    for (const app of ["web", "worker"] as const)
      for (const mode of ["mock", "replay", "record"]) {
        const r = await boot(app, {
          NODE_ENV: "production",
          LLM_MODE: mode,
          APP_ENV: "local",
          STACK_PROFILE: "native",
        });
        expect(r.code, `${app} ${mode} ${r.out}`).toBe(1);
        expect(r.out).toContain("LLM_MODE");
      }
  });
  it("AC-06-52 APP_ENV=prod + AUTH_DRIVER=local → 기동 거부, dev_mail_outbox를 읽는 HTTP 라우트 0개", async () => {
    const r = await boot("web", { APP_ENV: "prod", AUTH_DRIVER: "local", STACK_PROFILE: "native" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("AUTH_DRIVER");
    const src = listFiles(join(ROOT, "apps/web/src")).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(src.filter((f) => readFileSync(f, "utf8").includes("dev_mail_outbox"))).toEqual([]);
  });
  it("AC-07-13 web에 테스트 전용 로그인 라우트·인증 우회 코드 0(TC-S-09), 로그인은 매직링크뿐", () => {
    const app = listFiles(join(ROOT, "apps/web/src/app")).map((f) =>
      f.slice(join(ROOT, "apps/web/src/app").length),
    );
    expect(app.filter((p) => /\/(test|__test|dev-login|e2e)(\/|$)/i.test(p))).toEqual([]);
    const src = listFiles(join(ROOT, "apps/web/src")).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"),
    );
    for (const f of src)
      expect(readFileSync(f, "utf8"), f).not.toMatch(
        /TEST_AUTH_BYPASS|\/api\/test\/login|bypassAuth/,
      );
  });
});

describe("06장 AC-06-60 관리자 판정·제재 승계(T-12)", () => {
  it("AC-06-60 ① 마이그레이션 SQL(실행문, 주석 제외)에 ADMIN_EMAILS·CONSENT_HASH_KEY·current_setting('app. 0건", () => {
    const dir = join(ROOT, "packages/db/supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n")
      // 주석은 06장 6.3.3 DDL 원문 설명(키 이름 언급)이라 제외하고 실행되는 SQL만 본다(ASM-113 ①)
      .replace(/--[^\n]*/g, "");
    for (const s of ["ADMIN_EMAILS", "CONSENT_HASH_KEY", "current_setting('app."])
      expect(sql).not.toContain(s);
  });
  it("AC-06-60 ② 정지 이력 이메일 재가입 → 콜백 provision_user가 승계 → 생성 API 403 ACCOUNT_SUSPENDED", async () => {
    const email = `ban-${randomBytes(3).toString("hex")}@example.com`;
    const hash = createHmac("sha256", HASH_KEY).update(email).digest("hex");
    await db.withService((tx) =>
      q(
        tx,
        "insert into sanctions (email_hash, level, until, reason_code, created_at) values ($1, 'suspended', now() + interval '30 days', 'phishing', now())",
        [hash],
      ),
    );
    const jar = new Jar();
    const resultId = await survey(jar);
    await login(jar, email);
    await call(jar, "POST", "/api/consents", {
      items: ["age_14", "terms", "privacy_notice"].map((docType) => ({
        docType,
        docVersion: "2026-11-16",
        agreed: true,
      })),
    });
    const p = await call(jar, "POST", "/api/projects", {
      resultId,
      purpose: "saas",
      brand: {
        name: "택스퀵",
        description: "프리랜서의 세금 신고를 10분 만에 끝내 주는 앱",
        primaryAction: "signup",
      },
      useSampleContent: false,
    });
    expect([p.status, (p.body.error as { code?: string } | undefined)?.code]).toEqual([
      403,
      "ACCOUNT_SUSPENDED",
    ]);
    const g = await call(
      jar,
      "POST",
      `/api/projects/${randomUUID()}/generations`,
      { kind: "initial" },
      { "idempotency-key": `k_${randomUUID()}` },
    );
    expect([g.status, (g.body.error as { code?: string } | undefined)?.code]).toEqual([
      403,
      "ACCOUNT_SUSPENDED",
    ]);
  });
  it("AC-06-60 ③④ ADMIN_EMAILS에 있으면 첫 로그인 후 role=admin, 목록에서 빠지면 다음 로그인에 role=user, aal1 관리자 경로 404", async () => {
    const jar = new Jar();
    await login(jar, ADMIN);
    const me = await call(jar, "GET", "/api/me");
    expect(me.body.role).toBe("admin");
    expect((await call(jar, "GET", "/api/admin/users")).status).toBe(404);
    const demoted: Deps = { ...deps, adminEmails: "someone-else@example.com" };
    const prev = deps;
    deps = demoted;
    try {
      const j2 = new Jar();
      await login(j2, ADMIN);
      expect((await call(j2, "GET", "/api/me")).body.role).toBe("user");
      expect((await call(j2, "GET", "/api/admin/users")).status).toBe(404);
    } finally {
      deps = prev;
    }
  });
});
