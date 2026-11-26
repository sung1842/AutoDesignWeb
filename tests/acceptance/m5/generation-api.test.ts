// M5 수용 테스트(4/7): 프로젝트·생성 API(06장 6.4.3·6.4.4·6.5.5, 08장 8.7.4 C·8.9.2). 잡은 큐에 넣기까지만 본다
// (워커 실행·노출은 pipeline 테스트 e). AC-06-09·10·13·17·45, TC-B-18, GenerationView·ETag·queuePosition. 계약: ASSUMPTIONS ASM-108.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import {
  latestMagicLink,
  seedSimilarSites,
  seedSurveyFixture,
} from "../../../packages/db/src/testing/fixtures.js";
import { createLocalAuth } from "../../../packages/auth/src/index.js";
import { GenerationViewSchema } from "../../../packages/api-contract/src/index.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { requestMagicLink } from "../../../apps/web/src/server/auth.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5gen";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const H25 = 25 * 3_600_000;
let db: DbPort;
let deps: Deps;

interface Res {
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}
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
async function call(
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
  d: Deps = deps,
): Promise<Res> {
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
    d,
  );
  jar.take(res.headers);
  const t = await res.text();
  return {
    status: res.status,
    body: t.startsWith("{") ? (JSON.parse(t) as Record<string, unknown>) : {},
    headers: res.headers,
  };
}
type View = {
  id: string;
  resultId: string | null;
  question: { seq: number; itemKey: string; items: string[] } | null;
};
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
  return v.resultId ?? "";
}
async function login(jar: Jar, email: string): Promise<void> {
  await requestMagicLink(deps, { email, next: "/me", turnstileToken: "local-ok" });
  const link = new URL(await latestMagicLink(db, email));
  expect((await call(jar, "GET", `${link.pathname}${link.search}`)).status).toBe(302);
}
const consent = (jar: Jar) =>
  call(jar, "POST", "/api/consents", {
    items: ["age_14", "terms", "privacy_notice"].map((docType) => ({
      docType,
      docVersion: "2026-11-16",
      agreed: true,
    })),
  });
const BRAND = {
  name: "온결 베이커리",
  description: "망원동에서 매일 아침 굽는 사워도우 빵집",
  primaryAction: "reserve",
};
const project = (jar: Jar, resultId: string, over: Record<string, unknown> = {}) =>
  call(jar, "POST", "/api/projects", {
    resultId,
    purpose: "local_business",
    brand: BRAND,
    useSampleContent: false,
    ...over,
  });
const key = () => `k_${randomUUID()}`;
const generate = (
  jar: Jar,
  projectId: string,
  k: string | null,
  body: unknown = { kind: "initial" },
  extra: Record<string, string> = {},
) =>
  call(jar, "POST", `/api/projects/${projectId}/generations`, body, {
    ...(k ? { "idempotency-key": k } : {}),
    ...extra,
  });
const email = () => `g-${randomBytes(4).toString("hex")}@example.com`;
/** 익명 진단 → 로그인 → 동의 → 결과 귀속까지 끝낸 사용자. */
async function readyUser(): Promise<{ jar: Jar; resultId: string; addr: string }> {
  const jar = new Jar();
  const resultId = await completeSurvey(jar);
  const addr = email();
  await login(jar, addr);
  expect((await consent(jar)).status).toBe(204);
  return { jar, resultId, addr };
}
const errCode = (r: Res) => (r.body.error as { code?: string } | undefined)?.code;
const details = (r: Res) =>
  (r.body.error as { details?: Record<string, unknown> } | undefined)?.details;

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

describe("AC-06-17 · AC-06-13 인증·동의 게이트", () => {
  it("비로그인 POST /api/projects·생성 요청 → 401", async () => {
    const jar = new Jar();
    const rid = await completeSurvey(jar);
    expect((await project(jar, rid)).status).toBe(401);
    expect((await generate(jar, randomUUID(), key())).status).toBe(401);
  });
  it("동의 없는 로그인 사용자의 프로젝트·생성 요청 → 403 CONSENT_REQUIRED(details.docTypes)", async () => {
    const { jar, resultId } = await readyUser();
    const pid = String((await project(jar, resultId)).body.projectId);
    const fresh = new Jar();
    const rid2 = await completeSurvey(fresh);
    await login(fresh, email());
    const p = await project(fresh, rid2);
    expect(p.status).toBe(403);
    expect(errCode(p)).toBe("CONSENT_REQUIRED");
    expect((details(p)?.docTypes as string[]).sort()).toEqual(["age_14", "terms"]);
    // 남의 프로젝트라도 동의 검사가 먼저(존재 은닉과 무관한 403)
    const g = await generate(fresh, pid, key());
    expect(g.status).toBe(403);
    expect(errCode(g)).toBe("CONSENT_REQUIRED");
  });
});

describe("POST /api/projects(6.4.3·6.4.5)", () => {
  it("201 {projectId, maskedFields}, 남의 resultId → 404, 6.4.5 검증 공유(400·422)", async () => {
    const { jar, resultId } = await readyUser();
    const ok = await project(jar, resultId, {
      brand: { ...BRAND, description: "예약 문의 010-1234-5678 로 주세요" },
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.maskedFields).toEqual({ phone: 1 });
    const row = await db.withService((tx) =>
      q(tx, "select brand, title, brand_hash, taste_snapshot from projects where id = $1", [
        ok.body.projectId,
      ]),
    );
    expect(JSON.stringify(row.rows[0]?.brand)).not.toContain("010-1234-5678");
    expect(row.rows[0]?.title).toBe(BRAND.name);
    expect(String(row.rows[0]?.brand_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect((row.rows[0]?.taste_snapshot as { type_id?: string }).type_id).toMatch(/^T[1-8]$/);
    const other = await readyUser();
    expect((await project(other.jar, resultId)).status).toBe(404);
    expect((await project(jar, resultId, { brand: { ...BRAND, name: "" } })).status).toBe(400);
    const blocked = await project(jar, resultId, { brand: { ...BRAND, name: "국민은행" } });
    expect([blocked.status, errCode(blocked)]).toEqual([422, "BLOCKED_BRAND"]);
  });
  it("TC-B-18 레퍼런스 사이트명 일치 → 422 BRAND_ATTESTATION_REQUIRED, brandAttested:true 재제출 → 201 + consents brand_attestation(subject_ref)", async () => {
    const ref = await db.withService((tx) =>
      q(tx, "select title from reference_sites where title is not null order by id limit 1"),
    );
    const title = String(ref.rows[0]?.title ?? "");
    expect(title).not.toBe("");
    const { jar, resultId } = await readyUser();
    const brand = { ...BRAND, name: title.slice(0, 30) };
    const r1 = await project(jar, resultId, { brand });
    expect([r1.status, errCode(r1)]).toEqual([422, "BRAND_ATTESTATION_REQUIRED"]);
    const r2 = await project(jar, resultId, { brand, brandAttested: true });
    expect(r2.status, JSON.stringify(r2.body)).toBe(201);
    const me = await call(jar, "GET", "/api/me");
    const c = await db.withService((tx) =>
      q(
        tx,
        "select subject_ref, agreed from consents where user_id = $1 and doc_type = 'brand_attestation'",
        [me.body.id],
      ),
    );
    expect(c.rowCount).toBe(1);
    expect(String(c.rows[0]?.subject_ref)).toMatch(/^[0-9a-f]{64}$/);
    expect(c.rows[0]?.agreed).toBe(true);
  });
  it("AC-06-45 익명 임시본 → 로그인·동의 → POST /api/projects {briefDraftId} 201·consumed_at, +25h GET → 410, retention 후 행 0", async () => {
    const jar = new Jar();
    const resultId = await completeSurvey(jar);
    const d = await call(jar, "POST", "/api/brief-drafts", {
      resultId,
      purpose: "local_business",
      brand: BRAND,
      useSampleContent: false,
    });
    expect(d.status).toBe(201);
    const draftId = String(d.body.briefDraftId);
    await login(jar, email());
    expect((await consent(jar)).status).toBe(204);
    expect((await call(jar, "GET", `/api/brief-drafts/${draftId}`)).status).toBe(200);
    const p = await project(jar, resultId, { briefDraftId: draftId });
    expect(p.status, JSON.stringify(p.body)).toBe(201);
    const row = await db.withService((tx) =>
      q(tx, "select consumed_at from brief_drafts where id = $1", [draftId]),
    );
    expect(row.rows[0]?.consumed_at).not.toBeNull();
    const later = { ...deps, now: () => new Date(Date.now() + H25) };
    const g = await call(jar, "GET", `/api/brief-drafts/${draftId}`, undefined, {}, later);
    expect([g.status, errCode(g)]).toEqual([410, "DRAFT_EXPIRED"]);
    // 워커 retention 잡(06장 6.6 brief_drafts 규칙). 동적 import: 모듈이 없어도 다른 사례 수집은 된다
    const { runRetention } = (await import("../../../apps/worker/src/jobs/retention.js")) as {
      runRetention: (d: DbPort, o: { now: Date }) => Promise<unknown>;
    };
    await runRetention(db, { now: new Date(Date.now() + H25) });
    const n = await db.withService((tx) =>
      q(tx, "select 1 from brief_drafts where id = $1", [draftId]),
    );
    expect(n.rowCount).toBe(0);
  });
});

describe("POST /api/projects/:id/generations · GET /api/generations/:jobId", () => {
  it("AC-06-09 같은 Idempotency-Key 2회 → 같은 jobId·잡 1행, 같은 키·다른 본문 → 422, 키 누락·형식 오류 → 400", async () => {
    const { jar, resultId } = await readyUser();
    const pid = String((await project(jar, resultId)).body.projectId);
    const k = key();
    const a = await generate(jar, pid, k);
    expect(a.status, JSON.stringify(a.body)).toBe(202);
    const b = await generate(jar, pid, k);
    expect(b.status).toBe(202);
    expect(b.body.jobId).toBe(a.body.jobId);
    const n = await db.withService((tx) =>
      q(tx, "select 1 from generation_jobs where project_id = $1", [pid]),
    );
    expect(n.rowCount).toBe(1);
    const c = await generate(jar, pid, k, { kind: "regenerate" });
    expect([c.status, errCode(c)]).toEqual([422, "IDEMPOTENCY_KEY_REUSED"]);
    const none = await generate(jar, pid, null);
    expect([none.status, errCode(none)]).toEqual([400, "IDEMPOTENCY_KEY_REQUIRED"]);
    expect((await generate(jar, pid, "short")).status).toBe(400);
  });
  it("AC-06-10 진행 중 잡이 있으면 다른 키로도 409 JOB_IN_PROGRESS + details.jobId = 기존 잡", async () => {
    const { jar, resultId } = await readyUser();
    const pid = String((await project(jar, resultId)).body.projectId);
    const first = await generate(jar, pid, key());
    const pid2 = String(
      (
        await project(jar, resultId, {
          purpose: "saas",
          brand: { ...BRAND, primaryAction: "signup" },
        })
      ).body.projectId,
    );
    const again = await generate(jar, pid2, key());
    expect([again.status, errCode(again)]).toEqual([409, "JOB_IN_PROGRESS"]);
    expect(details(again)?.jobId).toBe(first.body.jobId);
  });
  it("GenerationView 스키마·queued 초기값·queuePosition = 앞선 queued 수 + 1·config_snapshot(llmMode·mockScenario)", async () => {
    const u1 = await readyUser();
    const u2 = await readyUser();
    const p1 = String((await project(u1.jar, u1.resultId)).body.projectId);
    const p2 = String((await project(u2.jar, u2.resultId)).body.projectId);
    const before = await db.withService((tx) =>
      q(tx, "select count(*)::int as n from generation_jobs where status = 'queued'"),
    );
    const g1 = await generate(u1.jar, p1, key());
    const g2 = await generate(
      u2.jar,
      p2,
      key(),
      { kind: "initial" },
      { "x-mock-scenario": "mixed" },
    );
    for (const g of [g1, g2]) {
      const v = GenerationViewSchema.safeParse(g.body);
      expect(v.success, JSON.stringify(v.error?.issues?.slice(0, 3))).toBe(true);
      expect(g.body).toMatchObject({
        status: "queued",
        phase: "queued",
        progressPct: 0,
        mockups: [],
        copySource: null,
        errorCode: null,
        startedAt: null,
        finishedAt: null,
      });
      expect(Number(g.body.pollAfterMs)).toBeGreaterThan(0);
    }
    const base = Number(before.rows[0]?.n);
    expect(g1.body.queuePosition).toBe(base + 1);
    expect(g2.body.queuePosition).toBe(base + 2);
    const snap = await db.withService((tx) =>
      q(tx, "select config_snapshot from generation_jobs where id = $1", [g2.body.jobId]),
    );
    const cs = snap.rows[0]?.config_snapshot as Record<string, unknown>;
    expect(cs.llmMode).toBe("mock");
    expect(cs.mockScenario).toBe("mixed");
    expect(typeof cs.modelsRevision).toBe("number");
    expect(Object.keys(cs.roles as object).sort()).toEqual([
      "gen_copy",
      "gen_layout",
      "judge_vision",
      "ref_tagger",
    ]);
  });
  it("GET /api/generations/:jobId: 200 + ETag, If-None-Match 일치 → 304, 남의 잡 → 404, 비로그인 → 401", async () => {
    const { jar, resultId } = await readyUser();
    const pid = String((await project(jar, resultId)).body.projectId);
    const jobId = String((await generate(jar, pid, key())).body.jobId);
    const g = await call(jar, "GET", `/api/generations/${jobId}`);
    expect(g.status).toBe(200);
    expect(g.body.jobId).toBe(jobId);
    const etag = g.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f]{40}"$/);
    expect(
      (
        await call(jar, "GET", `/api/generations/${jobId}`, undefined, {
          "if-none-match": etag ?? "",
        })
      ).status,
    ).toBe(304);
    const other = await readyUser();
    expect((await call(other.jar, "GET", `/api/generations/${jobId}`)).status).toBe(404);
    expect((await call(new Jar(), "GET", `/api/generations/${jobId}`)).status).toBe(401);
  });
});
