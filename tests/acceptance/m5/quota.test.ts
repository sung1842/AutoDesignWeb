// M5 수용 테스트(6/7): 한도·취소 환불·킬 스위치·예산·레이트리밋·초대·잡 예산 예약
// (00장 9.3 AC-00-15~17, 06장 6.2.3·6.9.4 ⑤·6.10 AC-06-19·20·23·55·62·63, 00장 7.2 초대). 워커 렌더 없이 잡 행을 직접 종료한다.
// 계약: ASSUMPTIONS ASM-110.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import {
  latestMagicLink,
  seedSimilarSites,
  seedSurveyFixture,
} from "../../../packages/db/src/testing/fixtures.js";
import { createLocalAuth } from "../../../packages/auth/src/index.js";
import { createJobBudget } from "../../../packages/pipeline/src/index.js";
import { handle, type Deps } from "../../../apps/web/src/server/api.js";
import { requestMagicLink } from "../../../apps/web/src/server/auth.js";
import { ROOT, run } from "../_support/sh.js";

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5quota";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
/** 테스트 시계: 레이트리밋 창(1분)을 넘기려고 요청마다 앞으로 민다. KST 정오에서 시작해 하루를 넘기지 않는다. */
let clock = Date.parse("2026-11-27T03:00:00Z");
const tick = (ms = 61_000) => (clock += ms);
/** 반복 3회(일 한도 3·취소 3회·레이트리밋 3번째 요청). */
const THREE = [0, 1, 2] as const;
/** 6.10.1 Retry-After 허용 값(1~60초). */
const RETRY_AFTER_S = Array.from({ length: 60 }, (_, i) => i + 1);
/** AC-06-62 ②: 7개 중 앞 3개가 server_error 후 재시도. */
const RETRIED = new Set([0, 1, 2]);
let db: DbPort;
let deps: Deps;
type Worker = {
  finishGenerationJob: (
    db: DbPort,
    jobId: string,
    o?: { now?: Date },
  ) => Promise<{ status: string; refunded: boolean }>;
  applyKillSwitch: (db: DbPort, o?: { now?: Date }) => Promise<number>;
};
let worker: Worker;

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
    headers: res.headers,
    body: t.startsWith("{") ? (JSON.parse(t) as Record<string, unknown>) : {},
  };
}
type View = {
  id: string;
  resultId: string | null;
  question: { seq: number; itemKey: string; items: string[] } | null;
};
const rows = async (sql: string, p: unknown[] = []) =>
  (await db.withService((tx) => q(tx, sql, p))).rows;
const setFlag = (key: string, value: unknown) =>
  db.withService((tx) =>
    q(
      tx,
      "insert into feature_flags (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()",
      [key, JSON.stringify(value)],
    ),
  );
const clearFlag = (key: string) =>
  db.withService((tx) => q(tx, "delete from feature_flags where key = $1", [key]));
const errOf = (r: { body: Record<string, unknown> }) =>
  r.body.error as
    { code?: string; details?: Record<string, unknown>; retryAfterS?: number } | undefined;

/** 진단 완료·로그인·동의·프로젝트 1개까지 마친 사용자. */
async function user(): Promise<{ jar: Jar; id: string; projectId: string }> {
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
  const addr = `q-${randomBytes(4).toString("hex")}@example.com`;
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
  const p = await call(jar, "POST", "/api/projects", {
    resultId: v.resultId,
    purpose: "local_business",
    brand: {
      name: "온결 베이커리",
      description: "망원동에서 매일 아침 굽는 사워도우 빵집",
      primaryAction: "reserve",
    },
    useSampleContent: false,
  });
  const me = await call(jar, "GET", "/api/me");
  return { jar, id: String(me.body.id), projectId: String(p.body.projectId) };
}
const gen = (u: { jar: Jar; projectId: string }) => {
  tick();
  return call(
    u.jar,
    "POST",
    `/api/projects/${u.projectId}/generations`,
    { kind: "initial" },
    { "idempotency-key": `k_${randomUUID()}` },
  );
};
/** 워커 대신 잡을 끝낸다: 노출 수를 적고 finish(R-15 판정·환불). */
async function finish(jobId: string, nReal: number, nFallback: number) {
  await db.withService((tx) =>
    q(
      tx,
      "update generation_jobs set status = 'running', started_at = $2, n_real = $3, n_fallback = $4 where id = $1",
      [jobId, new Date(clock).toISOString(), nReal, nFallback],
    ),
  );
  return worker.finishGenerationJob(db, jobId, { now: new Date(clock) });
}
const quota = async (u: { jar: Jar }) =>
  (await call(u.jar, "GET", "/api/me")).body.quota as Record<string, number>;
const ledger = (jobId: string) =>
  rows("select kind from quota_ledger where job_id = $1 order by kind", [jobId]);

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
    now: () => new Date(clock),
    auth: createLocalAuth({ db, secret: randomBytes(32).toString("base64url"), webOrigin: ORIGIN }),
  };
  process.env.BETA_INVITE_ONLY = "false";
  worker = (await import("../../../apps/worker/src/jobs/finish.js")) as unknown as Worker;
});
afterAll(async () => {
  await db?.close();
});

describe("00장 9.3 한도·quota_ledger", () => {
  it("AC-00-15 같은 날 4번째 요청 → 429 QUOTA_DAY(details.limit·resetAt·reason=quota) + generate_rejected, reserve 3행", async () => {
    const u = await user();
    for (const k of THREE) {
      const g = await gen(u);
      expect(g.status, `#${k} ${JSON.stringify(g.body)}`).toBe(202);
      await finish(String(g.body.jobId), 3, 0);
    }
    const fourth = await gen(u);
    expect([fourth.status, errOf(fourth)?.code]).toEqual([429, "QUOTA_DAY"]);
    expect(errOf(fourth)?.details).toMatchObject({ limit: 3, reason: "quota" });
    expect(Date.parse(String(errOf(fourth)?.details?.resetAt))).toBeGreaterThan(clock);
    const ev = await rows(
      "select props from events where name = 'generate_rejected' and user_id = $1",
      [u.id],
    );
    expect(ev.length).toBe(1);
    const res = await rows(
      "select count(*)::int as n from quota_ledger where user_id = $1 and kind = 'reserve'",
      [u.id],
    );
    expect(res[0]?.n).toBe(3);
    expect(await quota(u)).toMatchObject({ dayLimit: 3, dayUsed: 3, monthLimit: 15, monthUsed: 3 });
  });
  it("AC-00-16 · R-15 failed·fallback은 환불(잔여 불변), succeeded·partial은 차감", async () => {
    const u = await user();
    const cases: [number, number, string, boolean][] = [
      [0, 0, "failed", true],
      [0, 2, "fallback", true],
      [1, 2, "partial", false],
    ];
    for (const [nr, nf, status, refunded] of cases) {
      const before = (await quota(u)).dayUsed;
      const g = await gen(u);
      const f = await finish(String(g.body.jobId), nr, nf);
      expect([f.status, f.refunded]).toEqual([status, refunded]);
      const k = (await ledger(String(g.body.jobId))).map((x) => x.kind);
      expect(k).toEqual(refunded ? ["refund", "reserve"] : ["reserve"]);
      expect((await quota(u)).dayUsed).toBe(refunded ? before : before + 1);
    }
  });
});

describe("06장 6.2.3 취소(AC-06-55·63)", () => {
  it("AC-06-55 queued 취소 → 환불·잔여 불변, 노출 1 이상 running 취소 → 차감, 종료 잡 취소 → 409 JOB_ALREADY_FINISHED", async () => {
    const u = await user();
    const a = await gen(u);
    const ca = await call(u.jar, "POST", `/api/generations/${String(a.body.jobId)}/cancel`, {});
    expect([ca.status, ca.body.refunded]).toEqual([202, true]);
    expect((await quota(u)).dayUsed).toBe(0);
    const b = await gen(u);
    await db.withService((tx) =>
      q(tx, "update generation_jobs set status = 'running', n_real = 1 where id = $1", [
        b.body.jobId,
      ]),
    );
    const cb = await call(u.jar, "POST", `/api/generations/${String(b.body.jobId)}/cancel`, {});
    expect([cb.status, cb.body.refunded]).toEqual([202, false]);
    expect((await quota(u)).dayUsed).toBe(1);
    const again = await call(u.jar, "POST", `/api/generations/${String(b.body.jobId)}/cancel`, {});
    expect([again.status, errOf(again)?.code]).toEqual([409, "JOB_ALREADY_FINISHED"]);
    const st = await rows("select status, finished_at from generation_jobs where id = $1", [
      b.body.jobId,
    ]);
    expect(st[0]?.status).toBe("canceled");
    expect(st[0]?.finished_at).not.toBeNull();
  });
  it("AC-06-63 ① 노출 0 취소 3회(같은 KST 날짜) → 1·2번째 환불, 3번째 차감, refund 2행, refundableCancelsLeft 2→1→0", async () => {
    const u = await user();
    const left: number[] = [(await quota(u)).refundableCancelsLeft ?? -1];
    const refunded: unknown[] = [];
    for (const k of THREE) {
      const g = await gen(u);
      expect(g.status, `#${k}`).toBe(202);
      const c = await call(u.jar, "POST", `/api/generations/${String(g.body.jobId)}/cancel`, {});
      refunded.push(c.body.refunded);
      left.push((await quota(u)).refundableCancelsLeft ?? -1);
    }
    expect(refunded).toEqual([true, true, false]);
    expect(left).toEqual([2, 1, 0, 0]);
    const n = await rows(
      "select count(*)::int as n from quota_ledger where user_id = $1 and kind = 'refund'",
      [u.id],
    );
    expect(n[0]?.n).toBe(2);
    expect((await quota(u)).dayUsed).toBe(1);
  });
  it("AC-06-63 ② 계정 당일 user_job 원가 ≥ USER_DAILY_COST_CAP_USD → 429 QUOTA_DAY(reason=cost_cap)", async () => {
    const u = await user();
    const g = await gen(u);
    await finish(String(g.body.jobId), 3, 0);
    await db.withService((tx) =>
      q(
        tx,
        `insert into llm_calls (job_id, owner_id, role, call_kind, purpose, processor_id, model, prompt_id, prompt_version, prompt_sha256, mode, cost_usd, status, request_hash, started_at)
         select $1, $2, 'gen_layout', 'initial', 'user_job', 'mock', 'mock-page', 'gen_layout', 1, '', 'mock', 0.3, 'ok', 'h', $3 from generate_series(1, 5)`,
        [g.body.jobId, u.id, new Date(clock).toISOString()],
      ),
    );
    const r = await gen(u);
    expect([r.status, errOf(r)?.code, errOf(r)?.details?.reason]).toEqual([
      429,
      "QUOTA_DAY",
      "cost_cap",
    ]);
  });
});

describe("06장 6.10 킬 스위치·예산·레이트리밋", () => {
  it("AC-06-20 GEN_ENABLED=false → 신규 503 GEN_DISABLED, 기존 queued 잡 failed(GEN_DISABLED) + refund 1행", async () => {
    const u = await user();
    const g = await gen(u);
    await setFlag("GEN_ENABLED", false);
    try {
      const other = await user();
      const r = await gen(other);
      expect([r.status, errOf(r)?.code]).toEqual([503, "GEN_DISABLED"]);
      expect(await worker.applyKillSwitch(db, { now: new Date(clock) })).toBeGreaterThan(0);
      const j = await rows("select status, error_code from generation_jobs where id = $1", [
        g.body.jobId,
      ]);
      expect(j[0]).toMatchObject({ status: "failed", error_code: "GEN_DISABLED" });
      expect((await ledger(String(g.body.jobId))).map((x) => x.kind)).toEqual([
        "refund",
        "reserve",
      ]);
    } finally {
      await clearFlag("GEN_ENABLED");
    }
  });
  it("AC-00-17 · AC-06-23 GEN_DAILY_BUDGET_USD=0.5: 당일 user_job 원가 + 0.30 > 0.5면 503 GEN_BUDGET_EXCEEDED(details.resetAt), 진행 중 잡은 그대로", async () => {
    const u = await user();
    const running = await gen(u);
    await setFlag("GEN_DAILY_BUDGET_USD", 0.5);
    try {
      await db.withService((tx) =>
        q(
          tx,
          `insert into llm_calls (job_id, owner_id, role, call_kind, purpose, processor_id, model, prompt_id, prompt_version, prompt_sha256, mode, cost_usd, status, request_hash, started_at)
           values ($1, $2, 'gen_layout', 'initial', 'user_job', 'mock', 'mock-page', 'gen_layout', 1, '', 'mock', 0.25, 'ok', 'h', $3)`,
          [running.body.jobId, u.id, new Date(clock).toISOString()],
        ),
      );
      const other = await user();
      const r = await gen(other);
      expect([r.status, errOf(r)?.code]).toEqual([503, "GEN_BUDGET_EXCEEDED"]);
      expect(Date.parse(String(errOf(r)?.details?.resetAt))).toBeGreaterThan(clock);
      const j = await rows("select status from generation_jobs where id = $1", [
        running.body.jobId,
      ]);
      expect(j[0]?.status).toBe("queued");
    } finally {
      await clearFlag("GEN_DAILY_BUDGET_USD");
    }
  });
  it("AC-06-19 같은 계정 1분 안 생성 요청 3회 → 3번째 429 RATE_LIMITED, Retry-After 1~60", async () => {
    const u = await user();
    tick();
    const results: number[] = [];
    let last: Awaited<ReturnType<typeof call>> | null = null;
    for (const k of THREE) {
      expect(results, `#${k}`).toHaveLength(k);
      // 같은 분 안: 시계를 1초씩만 민다. 진행 중 잡 409를 피하려고 매번 종료
      clock += 1000;
      last = await call(
        u.jar,
        "POST",
        `/api/projects/${u.projectId}/generations`,
        { kind: "initial" },
        { "idempotency-key": `k_${randomUUID()}` },
      );
      results.push(last.status);
      if (last.status === 202) await finish(String(last.body.jobId), 3, 0);
    }
    expect(results).toEqual([202, 202, 429]);
    expect(errOf(last ?? { body: {} })?.code).toBe("RATE_LIMITED");
    const ra = Number(last?.headers.get("retry-after"));
    expect(RETRY_AFTER_S, String(ra)).toContain(ra);
  });
});

describe("00장 7.2 초대(BETA_INVITE_ONLY)", () => {
  it("초대 필수면 403 INVITE_REQUIRED → POST /api/invites/redeem 204 → 생성 202, 없는 코드 404, 소진 코드 409, inviteOk 반영", async () => {
    await setFlag("BETA_INVITE_ONLY", true);
    try {
      await db.withService((tx) =>
        q(
          tx,
          "insert into invites (code, max_uses, expires_at) values ('TASTEFIT01', 1, $1), ('TASTEFIT02', 1, $1)",
          [new Date(clock + 86_400_000).toISOString()],
        ),
      );
      const u = await user();
      expect((await call(u.jar, "GET", "/api/me")).body.inviteOk).toBe(false);
      const r = await gen(u);
      expect([r.status, errOf(r)?.code]).toEqual([403, "INVITE_REQUIRED"]);
      expect((await call(u.jar, "POST", "/api/invites/redeem", { code: "NOPE0000" })).status).toBe(
        404,
      );
      expect(
        (await call(u.jar, "POST", "/api/invites/redeem", { code: "TASTEFIT01" })).status,
      ).toBe(204);
      expect((await call(u.jar, "GET", "/api/me")).body.inviteOk).toBe(true);
      expect((await gen(u)).status).toBe(202);
      const v = await user();
      const used = await call(v.jar, "POST", "/api/invites/redeem", { code: "TASTEFIT01" });
      expect(used.status).toBe(409);
    } finally {
      await clearFlag("BETA_INVITE_ONLY");
    }
  });
});

describe("06장 6.9.4 ③~⑤ 잡 예산 예약(AC-06-62, 단위)", () => {
  it("AC-06-62 ① 동시 reserve 20회에서 spent + reserved > capEff인 순간 0회", async () => {
    const b = createJobBudget({ jobCapUsd: 0.3 });
    const peaks: number[] = [];
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        const r = await b.reserve(0.05, { role: "gen_layout", callKind: "initial" });
        peaks.push(b.spent + b.reserved);
        if (r.ok) await b.settle(r.id, 0.05);
      }),
    );
    expect(Math.max(...peaks)).toBeLessThanOrEqual(b.capEff + 1e-9);
    expect(b.spent).toBeLessThanOrEqual(b.capEff + 1e-9);
  });
  it("AC-06-62 ② 재시도 attempt마다 새 예약, 모든 시점 spent + reserved ≤ capEff / ③ JOB_COST_CAP_USD=0.25 → skipVisionEff 0.20·skipRepairEff 0.225", async () => {
    const b = createJobBudget({ jobCapUsd: 0.3 });
    const ids = new Set<string>();
    for (let k = 0; k < 7; k++) {
      const r = await b.reserve(0.03, { role: "gen_layout", callKind: "initial" });
      if (!r.ok) continue;
      ids.add(r.id);
      if (RETRIED.has(k)) {
        b.release(r.id);
        const again = await b.reserve(0.03, { role: "gen_layout", callKind: "initial" });
        if (again.ok) {
          ids.add(again.id);
          await b.settle(again.id, 0.03);
        }
      } else await b.settle(r.id, 0.03);
      expect(b.spent + b.reserved).toBeLessThanOrEqual(b.capEff + 1e-9);
    }
    expect(ids.size).toBe(10);
    const c = createJobBudget({ jobCapUsd: 0.25 });
    const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
    expect(r6(c.capEff)).toBe(0.25);
    expect(r6(c.skipVisionEff)).toBe(0.2);
    expect(r6(c.skipRepairEff)).toBe(0.225);
  });
  it("AC-06-62 stageSkip: judge_vision은 spent + reserved ≥ skipVisionEff, repair_quality·diversity는 ≥ skipRepairEff에서 생략", async () => {
    const b = createJobBudget({ jobCapUsd: 0.3 });
    const r = await b.reserve(0.24, { role: "gen_layout", callKind: "initial" });
    if (r.ok) await b.settle(r.id, 0.24);
    expect((await b.reserve(0.001, { role: "judge_vision", callKind: "initial" })).reason).toBe(
      "skip_vision",
    );
    expect((await b.reserve(0.001, { role: "gen_layout", callKind: "repair_quality" })).ok).toBe(
      true,
    );
    const s = await b.reserve(0.03, { role: "gen_layout", callKind: "initial" });
    if (s.ok) await b.settle(s.id, 0.03);
    expect((await b.reserve(0.001, { role: "gen_layout", callKind: "diversity" })).reason).toBe(
      "skip_repair",
    );
  });
});
