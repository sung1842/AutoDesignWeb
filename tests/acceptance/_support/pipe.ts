// M5 수용 테스트 공용 헬퍼(자체 잠금 대상): 사용자·프로젝트·잡을 API로 만들고 워커 함수를 같은 프로세스에서 돌린다.
// pipeline.test·scenarios.test가 쓴다. 계약: ASSUMPTIONS ASM-109·ASM-114.
import { expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import {
  latestMagicLink,
  seedSimilarSites,
  seedSurveyFixture,
} from "../../../packages/db/src/testing/fixtures.js";
import { createLocalAuth } from "../../../packages/auth/src/index.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { requestMagicLink } from "../../../apps/web/src/server/auth.js";
import { ROOT, run } from "./sh.js";

export const ORIGIN = "http://localhost:3000";
export const VARIANTS = ["v_true", "v_fit", "v_bal"];
/** 후보 슬롯 = variantIndex × 2 + slotIndex(9.6.2). */
export const SLOTS = [0, 1, 2, 3, 4, 5];

export class Jar {
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

type WorkerMod = {
  runGenerationJob: (
    d: { db: DbPort; harness: unknown; now?: () => Date },
    jobId: string,
  ) => Promise<unknown>;
  openPipelineHarness: () => Promise<{ close(): Promise<void> }>;
};
type View = {
  id: string;
  resultId: string | null;
  question: { seq: number; itemKey: string; items: string[] } | null;
};
export type Row = Record<string, unknown>;

export const BRAND = {
  name: "온결 베이커리",
  description: "망원동에서 매일 아침 굽는 사워도우 빵집",
  primaryAction: "reserve",
  keyPoints: ["매일 아침 굽는 빵", "천연 발효종"],
  brandColor: "#1F2A44",
};

/** R-15 종료 상태 판정(04장 4.12 표). */
export const r15 = (nReal: number, nFallback: number): string =>
  nReal === 3 ? "succeeded" : nReal >= 1 ? "partial" : nFallback >= 1 ? "fallback" : "failed";

export interface Pipe {
  db: DbPort;
  deps: Deps;
  call(
    jar: Jar,
    method: string,
    path: string,
    body?: unknown,
    extra?: Record<string, string>,
  ): Promise<{ status: number; body: Row }>;
  user(): Promise<{ jar: Jar; resultId: string }>;
  /** 새 사용자·프로젝트 → 생성 요청(x-mock-scenario) → 워커 실행 → 잡 행·뷰. */
  job(
    scenario: string,
    o?: {
      seed?: number;
      brand?: Record<string, unknown>;
      purpose?: string;
      /** 워커 시계(가짜 시계 시나리오, TC-R-17). */
      now?: () => Date;
      /** 같은 사용자·프로젝트로 다음 잡(AC-04-02 재현성). */
      reuse?: { jar: Jar; projectId: string };
    },
  ): Promise<{ jobId: string; row: Row; view: Row; jar: Jar; projectId: string }>;
  rows(sql: string, p: unknown[]): Promise<Row[]>;
  calls(jobId: string): Promise<Row[]>;
  cands(jobId: string): Promise<Row[]>;
  mockups(jobId: string): Promise<Row[]>;
  close(): Promise<void>;
}

/** DB 재생성·시드·하네스를 열고 헬퍼 묶음을 돌려준다(beforeAll에서 1회). */
export async function openPipe(dbName: string, env: Record<string, string> = {}): Promise<Pipe> {
  const url = `postgres://tastefit_app:tastefit_app@127.0.0.1:54322/${dbName}`;
  const ENV = { DATABASE_URL_DIRECT: url, DATABASE_URL_POOLED: url, STACK_PROFILE: "native" };
  const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
  expect(up.code, up.out).toBe(0);
  const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
  expect(r.code, r.out).toBe(0);
  const s = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
  expect(s.code, s.out).toBe(0);
  const db = createDbPort(url);
  await seedSurveyFixture(db);
  await seedSimilarSites(db);
  const deps: Deps = {
    db,
    webOrigin: ORIGIN,
    auth: createLocalAuth({ db, secret: randomBytes(32).toString("base64url"), webOrigin: ORIGIN }),
  };
  process.env.LLM_MODE = "mock";
  process.env.MOCK_LLM_LATENCY_MS = "0";
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const worker =
    (await import("../../../apps/worker/src/jobs/generation.js")) as unknown as WorkerMod;
  const harness = await worker.openPipelineHarness();

  const call: Pipe["call"] = async (jar, method, path, body, extra = {}) => {
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
    return { status: res.status, body: t.startsWith("{") ? (JSON.parse(t) as Row) : {} };
  };

  const user: Pipe["user"] = async () => {
    const jar = new Jar();
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
    const addr = `p-${randomBytes(4).toString("hex")}@example.com`;
    await requestMagicLink(deps, { email: addr, next: "/me", turnstileToken: "local-ok" });
    const link = new URL(await latestMagicLink(db, addr));
    await call(jar, "GET", `${link.pathname}${link.search}`);
    await call(jar, "POST", "/api/consents", {
      items: ["age_14", "terms", "privacy_notice"].map((docType) => ({
        docType,
        docVersion: "2026-11-16",
        agreed: true,
      })),
    });
    return { jar, resultId: v.resultId ?? "" };
  };

  const rows: Pipe["rows"] = async (sql, p) => (await db.withService((tx) => q(tx, sql, p))).rows;

  const job: Pipe["job"] = async (scenario, o = {}) => {
    let jar: Jar;
    let projectId: string;
    if (o.reuse) ({ jar, projectId } = o.reuse);
    else {
      const u = await user();
      jar = u.jar;
      const p = await call(jar, "POST", "/api/projects", {
        resultId: u.resultId,
        purpose: o.purpose ?? "local_business",
        brand: o.brand ?? BRAND,
        useSampleContent: false,
      });
      expect(p.status, JSON.stringify(p.body)).toBe(201);
      projectId = String(p.body.projectId);
    }
    const g = await call(
      jar,
      "POST",
      `/api/projects/${projectId}/generations`,
      { kind: "initial" },
      { "idempotency-key": `k_${randomUUID()}`, "x-mock-scenario": scenario },
    );
    expect(g.status, JSON.stringify(g.body)).toBe(202);
    const jobId = String(g.body.jobId);
    if (o.seed !== undefined)
      await rows("update generation_jobs set job_seed = $2 where id = $1", [jobId, o.seed]);
    await worker.runGenerationJob(o.now ? { db, harness, now: o.now } : { db, harness }, jobId);
    const row = (await rows("select * from generation_jobs where id = $1", [jobId]))[0] ?? {};
    const view = (await call(jar, "GET", `/api/generations/${jobId}`)).body;
    return { jobId, row, view, jar, projectId };
  };

  return {
    db,
    deps,
    call,
    user,
    job,
    rows,
    calls: (jobId) =>
      rows(
        "select role, call_kind, status, error_code, is_fallback, attempt, cost_usd, started_at, cache_write_tokens_in, cached_tokens_in, candidate_id from llm_calls where job_id = $1 order by started_at, created_at",
        [jobId],
      ),
    cands: (jobId) =>
      rows(
        "select id, variant, slot, origin, round, eligible, schema_valid, layout_tree, render_hash from candidates where job_id = $1 order by slot, created_at",
        [jobId],
      ),
    mockups: (jobId) =>
      rows(
        "select m.variant, m.is_fallback, c.layout_tree, c.render_hash from mockups m join candidates c on c.id = m.candidate_id where m.job_id = $1 order by m.variant",
        [jobId],
      ),
    close: async () => {
      await harness.close();
      await db.close();
    },
  };
}
