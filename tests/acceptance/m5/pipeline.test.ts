// M5 수용 테스트(5/7): 생성 파이프라인(Mock) S1~S9(04장 4.1·4.8·4.11·4.12, 06장 6.2·6.9.4, 07장 TC-R).
// 잡은 API로 만들고 워커 함수 runGenerationJob을 같은 프로세스에서 돌린다(Playwright Chromium 렌더 포함).
// AC-06-38·47·56(①②), AC-04-01·02·14·23·24a·47①, TC-R-04·05·06·14·15·16·18. 시간(slow·timeout)·비용 시나리오는 f.
// 계약: ASSUMPTIONS ASM-109.
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

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m5pipe";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const ORIGIN = "http://localhost:3000";
const VARIANTS = ["v_true", "v_fit", "v_bal"];
/** 후보 슬롯 = variantIndex × 2 + slotIndex(9.6.2). */
const SLOTS = [0, 1, 2, 3, 4, 5];
/** AC-04-23 잡당 레이아웃 repair_quality 허용 개수. */
const RQ_ALLOWED = [0, 1, 2, 3];
let db: DbPort;
let deps: Deps;
type Worker = {
  runGenerationJob: (d: { db: DbPort; harness: unknown }, jobId: string) => Promise<unknown>;
  openPipelineHarness: () => Promise<{ close(): Promise<void> }>;
};
let worker: Worker;
let harness: { close(): Promise<void> };

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
async function user(): Promise<{ jar: Jar; resultId: string }> {
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
}
const BRAND = {
  name: "온결 베이커리",
  description: "망원동에서 매일 아침 굽는 사워도우 빵집",
  primaryAction: "reserve",
  keyPoints: ["매일 아침 굽는 빵", "천연 발효종"],
  brandColor: "#1F2A44",
};
/** 새 사용자·프로젝트·잡(시나리오 헤더) → 워커 실행 → 잡 행. */
async function job(
  scenario: string,
  o: { seed?: number; brand?: Record<string, unknown>; purpose?: string } = {},
) {
  const u = await user();
  const p = await call(u.jar, "POST", "/api/projects", {
    resultId: u.resultId,
    purpose: o.purpose ?? "local_business",
    brand: o.brand ?? BRAND,
    useSampleContent: false,
  });
  expect(p.status, JSON.stringify(p.body)).toBe(201);
  const g = await call(
    u.jar,
    "POST",
    `/api/projects/${String(p.body.projectId)}/generations`,
    { kind: "initial" },
    {
      "idempotency-key": `k_${randomUUID()}`,
      "x-mock-scenario": scenario,
    },
  );
  expect(g.status, JSON.stringify(g.body)).toBe(202);
  const jobId = String(g.body.jobId);
  if (o.seed !== undefined)
    await db.withService((tx) =>
      q(tx, "update generation_jobs set job_seed = $2 where id = $1", [jobId, o.seed]),
    );
  await worker.runGenerationJob({ db, harness }, jobId);
  const row =
    (await db.withService((tx) => q(tx, "select * from generation_jobs where id = $1", [jobId])))
      .rows[0] ?? {};
  const view = (await call(u.jar, "GET", `/api/generations/${jobId}`)).body;
  return { jobId, row, view, jar: u.jar };
}
const rows = async (sql: string, p: unknown[]) =>
  (await db.withService((tx) => q(tx, sql, p))).rows;
const calls = (jobId: string) =>
  rows(
    "select role, call_kind, status, is_fallback, cache_write_tokens_in, cached_tokens_in, candidate_id from llm_calls where job_id = $1",
    [jobId],
  );
const cands = (jobId: string) =>
  rows(
    "select id, variant, slot, origin, round, eligible, schema_valid, layout_tree, render_hash from candidates where job_id = $1 order by slot, created_at",
    [jobId],
  );
const mockups = (jobId: string) =>
  rows(
    "select m.variant, m.is_fallback, c.layout_tree, c.render_hash from mockups m join candidates c on c.id = m.candidate_id where m.job_id = $1 order by m.variant",
    [jobId],
  );
/** R-15 종료 상태 판정(04장 4.12 표). */
const r15 = (nReal: number, nFallback: number) =>
  nReal === 3 ? "succeeded" : nReal >= 1 ? "partial" : nFallback >= 1 ? "fallback" : "failed";
const finished: Record<string, unknown>[] = [];

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
  process.env.LLM_MODE = "mock";
  process.env.MOCK_LLM_LATENCY_MS = "0";
  worker = (await import("../../../apps/worker/src/jobs/generation.js")) as unknown as Worker;
  harness = await worker.openPipelineHarness();
});
afterAll(async () => {
  await harness?.close();
  await db?.close();
});

describe("ok 시나리오(AC-06-38·47·56, AC-04-01·02)", () => {
  let ok: Awaited<ReturnType<typeof job>>;
  it("AC-06-38 succeeded·n_real 3·mockups 3(v_true·v_fit·v_bal)·candidates ≥ 6·llm_calls ≥ 7·config_snapshot 6.9.3 키", async () => {
    ok = await job("ok");
    finished.push(ok.row);
    expect(ok.row.status).toBe("succeeded");
    expect(ok.row.n_real).toBe(3);
    const m = await mockups(ok.jobId);
    expect(m.map((x) => x.variant)).toEqual(VARIANTS.slice().sort());
    expect(m.every((x) => x.is_fallback === false)).toBe(true);
    expect(new Set((await cands(ok.jobId)).map((x) => x.slot))).toEqual(new Set(SLOTS));
    expect((await calls(ok.jobId)).length).toBeGreaterThanOrEqual(7);
    const cs = ok.row.config_snapshot as Record<string, unknown>;
    for (const k of [
      "modelsRevision",
      "roles",
      "taxonomyVersion",
      "normalizerVersion",
      "rendererVersion",
      "compilerVersion",
      "thresholdsSha256",
      "originalityVersion",
      "flags",
      "llmMode",
    ])
      expect(cs, k).toHaveProperty(k);
    expect(ok.row.design_spec).not.toBeNull();
    expect(ok.row.copy_source).toBe("llm");
  });
  it("AC-06-56 ①② llm_calls 13행(gen_copy 1·gen_layout 6·judge_vision 6), budget_skipped 0, cache_write 1(후보 0)·cached 5", async () => {
    const c = await calls(ok.jobId);
    const n = (role: string) => c.filter((x) => x.role === role).length;
    expect([c.length, n("gen_copy"), n("gen_layout"), n("judge_vision")]).toEqual([13, 1, 6, 6]);
    expect(c.filter((x) => x.status === "budget_skipped")).toHaveLength(0);
    const lay = c.filter((x) => x.role === "gen_layout");
    expect(lay.filter((x) => Number(x.cache_write_tokens_in) > 0)).toHaveLength(1);
    expect(lay.filter((x) => Number(x.cached_tokens_in) > 0)).toHaveLength(5);
    const slot0 = (await cands(ok.jobId)).find((x) => x.slot === 0 && x.origin === "llm");
    const w = lay.find((x) => Number(x.cache_write_tokens_in) > 0);
    expect(w?.candidate_id).toBe(slot0?.id);
  });
  it("AC-06-47 GenerationView.mockups[*]: 스키마 통과, brandColorNotice·useSampleContent 필드, labelKey = variant.<v>", () => {
    const v = GenerationViewSchema.safeParse(ok.view);
    expect(v.success, JSON.stringify(v.error?.issues?.slice(0, 3))).toBe(true);
    const ms = ok.view.mockups as Record<string, unknown>[];
    expect(ms).toHaveLength(3);
    for (const m of ms) {
      expect(m).toHaveProperty("brandColorNotice");
      expect(m.useSampleContent).toBe(false);
      expect(m.labelKey).toBe(`variant.${String(m.variant)}`);
    }
    expect(ok.view.copySource).toBe("llm");
    expect(ok.view.pollAfterMs).toBeNull();
  });
  const SEED = 424242;
  let first: Awaited<ReturnType<typeof job>>;
  it("AC-04-01 1회차(job_seed 고정)", async () => {
    first = await job("ok", { seed: SEED });
    finished.push(first.row);
    expect(first.row.status).toBe("succeeded");
  });
  it("AC-04-01·02 2회차: 같은 job_seed·입력·config_snapshot → DesignSpec ×3·확정 트리 ×6·HTML/CSS ×6 SHA-256 동일", async () => {
    const b = await job("ok", { seed: SEED });
    finished.push(b.row);
    expect(JSON.stringify(first.row.design_spec)).toBe(JSON.stringify(b.row.design_spec));
    const key = (r: Record<string, unknown>[]) =>
      r
        .filter((x) => x.origin === "llm")
        .map((x) => [x.slot, JSON.stringify(x.layout_tree), x.render_hash]);
    const ca = key(await cands(first.jobId));
    expect(ca.map((x) => x[0])).toEqual(SLOTS);
    expect(ca).toEqual(key(await cands(b.jobId)));
    const strip = (cs: unknown) => {
      const o = { ...(cs as Record<string, unknown>) };
      delete o.mockScenario;
      return JSON.stringify(o);
    };
    expect(strip(first.row.config_snapshot)).toBe(strip(b.row.config_snapshot));
  });
});

describe("장애·수리·폴백(TC-R)", () => {
  it("TC-R-15 · AC-04-47 ① mixed: diversity 정확히 1(후보 1), repair_quality 정확히 1(후보 2), 재호출은 장애 미적용", async () => {
    const j = await job("mixed");
    finished.push(j.row);
    const c = await calls(j.jobId);
    const cs = await cands(j.jobId);
    const slotOf = (id: unknown) => cs.find((x) => x.id === id)?.slot;
    const div = c.filter((x) => x.call_kind === "diversity");
    const rq = c.filter((x) => x.call_kind === "repair_quality" && x.role === "gen_layout");
    expect(div.map((x) => slotOf(x.candidate_id))).toEqual([1]);
    expect(rq.map((x) => slotOf(x.candidate_id))).toEqual([2]);
    expect(["succeeded", "partial"]).toContain(j.row.status);
  });
  it("TC-R-04 invalid_json@0: 수리 후에도 실패면 후보 0만 폐기, 잡은 계속", async () => {
    const j = await job("invalid_json@0");
    finished.push(j.row);
    const ca = await cands(j.jobId);
    expect(ca.filter((x) => x.slot === 0).length).toBeGreaterThan(0);
    expect((await calls(j.jobId)).some((x) => x.call_kind === "repair_schema")).toBe(true);
    expect(ca.filter((x) => x.slot !== 0).every((x) => x.schema_valid === true)).toBe(true);
    expect(j.row.status).not.toBe("failed");
  });
  it("TC-R-05 schema_violation@2: zod 오류 경로 피드백 재요청, 수리 성공 시 정상", async () => {
    const j = await job("schema_violation@2");
    finished.push(j.row);
    expect(
      (await cands(j.jobId)).filter((x) => x.slot === 2).some((x) => x.schema_valid === true),
    ).toBe(true);
  });
  for (const sc of ["lint_error", "low_score@*"])
    it(`TC-R-06·14 ${sc}: 재생성 최대 1회 후 결정론 폴백만 노출, status=fallback`, async () => {
      const j = await job(sc);
      finished.push(j.row);
      expect(j.row.status).toBe("fallback");
      const m = await mockups(j.jobId);
      expect(m.length).toBeGreaterThan(0);
      expect(m.every((x) => x.is_fallback === true)).toBe(true);
      expect(Number(j.row.repair_rounds)).toBeLessThanOrEqual(1);
    });
  it("TC-R-16 copy_schema_fail@gen_copy: gen_copy initial 1 + repair_schema 1 + fallback 1 → 템플릿 덱, COPY_FALLBACK, succeeded 금지", async () => {
    const j = await job("copy_schema_fail@gen_copy");
    finished.push(j.row);
    const gc = (await calls(j.jobId)).filter((x) => x.role === "gen_copy");
    expect(gc.filter((x) => x.call_kind === "initial" && x.is_fallback === false)).toHaveLength(1);
    expect(gc.filter((x) => x.call_kind === "repair_schema")).toHaveLength(1);
    expect(gc.filter((x) => x.is_fallback === true)).toHaveLength(1);
    expect(j.row.copy_source).toBe("template");
    expect(j.row.warnings).toContain("COPY_FALLBACK");
    expect(j.view.copySource).toBe("template");
    expect(["partial", "fallback"]).toContain(j.row.status);
    expect((await mockups(j.jobId)).length).toBeGreaterThanOrEqual(1);
  });
  it("TC-R-18 copy_refusal@gen_copy: 우회 재요청 0, 노출 0, failed, errorCode BLOCKED_BRAND(content_policy)", async () => {
    const j = await job("copy_refusal@gen_copy");
    finished.push(j.row);
    const gc = (await calls(j.jobId)).filter((x) => x.role === "gen_copy");
    expect(gc).toHaveLength(1);
    expect(j.row.status).toBe("failed");
    expect(j.row.error_code).toBe("BLOCKED_BRAND");
    expect(String(j.row.error_message)).toContain("content_policy");
    expect(await mockups(j.jobId)).toHaveLength(0);
  });
  it("AC-04-14 · TC-S-11 injection_echo: 노출 트리의 링크는 페이지 내 앵커뿐, 출력에 evil.example·위조 전화번호 0", async () => {
    const j = await job("injection_echo");
    finished.push(j.row);
    const m = await mockups(j.jobId);
    const text = JSON.stringify(m.map((x) => x.layout_tree));
    for (const t of text.matchAll(/"target":"([^"]*)"/g)) expect(t[1]).toMatch(/^#/);
    const deck = JSON.stringify(j.row.copy_deck ?? {});
    expect(deck).not.toContain("evil.example");
    expect(deck).not.toContain("010-1234-5678");
  });
});

describe("잡 공통 불변식", () => {
  it("AC-04-23 round ≤ 1, 잡당 레이아웃 repair_quality ≤ 3 · AC-04-24a 종료 상태 = R-15(n_real·n_fallback)", async () => {
    expect(finished.length).toBeGreaterThan(0);
    for (const r of finished) {
      const id = String(r.id);
      expect(
        (await cands(id)).every((x) => Number(x.round) <= 1),
        id,
      ).toBe(true);
      const rq = (await calls(id)).filter(
        (x) => x.role === "gen_layout" && x.call_kind === "repair_quality",
      );
      expect(RQ_ALLOWED, id).toContain(rq.length);
      if (r.error_code === "BLOCKED_BRAND") continue;
      // 템플릿 덱이면 R-15 값과 partial 중 낮은 쪽(S-12, TC-R-16)
      const want = r15(Number(r.n_real), Number(r.n_fallback));
      expect(r.status, id).toBe(
        r.copy_source === "template" && want === "succeeded" ? "partial" : want,
      );
    }
  });
});
