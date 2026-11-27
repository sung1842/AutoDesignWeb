// M5 화면 E2E(01장 S06~S08): AC-01-01·26·29·31·34·51·58(①②③). 흐름 기본(AC-01-02·24·27·33)은 flow.spec.
// 서버 = e2e/serve.ts(web + worker 소비 루프, LLM_MODE=mock). 시나리오는 실행 env MOCK_LLM_SCENARIO(브리지가 테스트별로 준다).
// 계약: ASSUMPTIONS ASM-113·ASM-115. 오래 걸리는 slow 잡을 쓰는 AC-01-51을 마지막에 둔다.
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDbPort, q, type DbPort } from "../../packages/db/src/index.js";
import { latestMagicLink } from "../../packages/db/src/testing/fixtures.js";
import { thresholdNumber } from "../../packages/config/src/index.js";
import { KO } from "../../apps/web/src/copy/ko.js";
import { answerOne } from "../m4/helpers.js";
import { api, BRAND, DB, needScenario, surveyViaApi, userWithJob, waitDone } from "./helpers.js";

/** 잡 종료 대기 상한(초) = 강제 종료 시각(R-25). */
const KILL_S = thresholdNumber("generation.killAtSec");
/** AC-01-29 지연 주입 구간(ms)·표본 간격. */
const HOLD_MS = 5000;
const SAMPLE_MS = 1000;
/** AC-01-31 탭 닫은 뒤 재접속까지(ms). */
const REOPEN_MS = 30_000;
/** AC-01-51 동시에 실행 중으로 둘 잡 수·순번 관찰 폴링 횟수. */
const BUSY_JOBS = 5;
const QUEUE_POLLS = 3;

let db: DbPort;
test.beforeAll(() => {
  db = createDbPort(DB);
});
test.afterAll(async () => {
  await db.close();
});
const rows = async (sql: string, p: unknown[]) =>
  (await db.withService((tx) => q(tx, sql, p))).rows;
type Mockup = { variant: string; isFallback: boolean; photoSubstituted: boolean };

test("AC-01-01 익명 진단 시작 → 결과까지 로그인 요청 UI 0, login_prompt_view 0", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "진단 시작" }).click();
  let n = 0;
  for (;;) {
    await expect(page.getByRole("link", { name: /로그인/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /로그인/ })).toHaveCount(0);
    if ((await answerOne(page, n)) === "done") break;
    n++;
  }
  await expect(page).toHaveURL(/\/result/);
  await expect(page.getByRole("link", { name: /로그인/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /로그인/ })).toHaveCount(0);
  const anon = (await context.cookies()).find((c) => c.name === "anon_id")?.value ?? "";
  expect(anon).not.toBe("");
  const ev = await rows(
    "select count(*)::int as n from events where name = 'login_prompt_view' and anon_id = $1",
    [anon],
  );
  expect(ev[0]?.n).toBe(0);
});

/** 잡 준비(사용자·잡·세션)를 파일로 넘긴다: 생성 대기를 테스트당 러너 타임아웃 밖(앞 테스트들이 도는 동안)으로 뺀다(ASM-115 ⑥). */
const PREP_FILE = (key: string) => join(tmpdir(), `tf-e2e-m5-${key}.json`);
type Saved = { jobId: string; state: Awaited<ReturnType<BrowserContext["storageState"]>> };
async function prepJob(
  page: Page,
  context: BrowserContext,
  key: string,
  brand?: Record<string, unknown>,
) {
  const { jobId } = await userWithJob(page, db, brand);
  writeFileSync(PREP_FILE(key), JSON.stringify({ jobId, state: await context.storageState() }));
}
async function reopen(browser: Browser, key: string) {
  const saved = JSON.parse(readFileSync(PREP_FILE(key), "utf8")) as Saved;
  const ctx = await browser.newContext({ storageState: saved.state });
  const page = await ctx.newPage();
  await page.goto("/");
  return { ctx, page, jobId: saved.jobId };
}
/** 준비 뒤 확인 테스트 안에서 잡 종료를 기다리는 상한(초). */
const CHECK_WAIT_S = 20;
const NO_MATCH_BRAND = {
  name: "결무늬 연구소",
  description: "아무 업종 사전에도 없는 낱말로만 쓴 소개 문장",
  primaryAction: "contact",
};

test("AC-01-34 준비: ok 잡 생성", async ({ page, context }) => {
  needScenario("ok");
  await prepJob(page, context, "ac-01-34");
});
test("AC-01-58 ③ 준비: 업종 매칭 0 브리프 잡 생성", async ({ page, context }) => {
  needScenario("ok");
  await prepJob(page, context, "ac-01-58-3", NO_MATCH_BRAND);
});

test("AC-01-26 익명 제출 → 매직링크를 다른 브라우저에서 열고 로그인·동의 → 그 브라우저 S06 복원·자동 제출", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const resultId = await surveyViaApi(page);
  await page.goto(`/brief?result=${resultId}`);
  await page.getByRole("button", { name: "카페·식당·공방" }).click();
  await page.getByLabel("브랜드 이름").fill(BRAND.name);
  await page.getByLabel("한 줄 소개").fill(BRAND.description);
  await page.getByLabel("예약하기").check();
  await page.getByRole("button", { name: "시안 만들기" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  const email = `e2e-other-${Date.now()}@example.com`;
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();
  await expect(page.getByTestId("sent")).toContainText(email);
  const other = await browser.newContext();
  try {
    const b = await other.newPage();
    await b.goto(await latestMagicLink(db, email));
    await expect(b).toHaveURL(/\/onboarding\/consent\?next=/);
    await b.getByLabel("만 14세 이상입니다.").check();
    await b.getByLabel(/이용약관/).check();
    await b.getByRole("button", { name: "시작하기" }).click();
    // 추가 클릭 없이 자동 제출 → /g/[jobId]
    await expect(b).toHaveURL(/\/g\/[0-9a-f-]{36}$/);
    const jobId = b.url().split("/g/")[1] ?? "";
    const p = await rows(
      "select p.brand, p.purpose from generation_jobs g join projects p on p.id = g.project_id where g.id = $1",
      [jobId],
    );
    const brand = p[0]?.brand as Record<string, unknown> | undefined;
    expect([brand?.name, brand?.description, brand?.primaryAction, p[0]?.purpose]).toEqual([
      BRAND.name,
      BRAND.description,
      BRAND.primaryAction,
      "local_business",
    ]);
  } finally {
    await other.close();
  }
});

test("AC-01-29 상태 응답 지연 주입 구간 동안 S07 단계 표시 변화 0", async ({ page }) => {
  needScenario("ok");
  const { jobId } = await userWithJob(page, db);
  const real = (await api(page, "GET", `/api/generations/${jobId}`)).body;
  const running = {
    ...real,
    status: "running",
    phase: "generating",
    progressPct: 30,
    pollAfterMs: SAMPLE_MS,
    mockups: [],
  };
  let first = true;
  await page.route(`**/api/generations/${jobId}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if (!first) await new Promise((r) => setTimeout(r, HOLD_MS * 2));
    first = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(running),
    });
  });
  await page.goto(`/g/${jobId}`);
  const steps = page.getByTestId("steps");
  await expect(steps).toBeVisible();
  const seen = new Set<string>();
  for (let t = 0; t < HOLD_MS; t += SAMPLE_MS) {
    seen.add(await steps.innerText());
    await page.waitForTimeout(SAMPLE_MS);
  }
  expect(seen.size).toBe(1);
  await page.unroute(`**/api/generations/${jobId}`);
});

// AC-01-31은 러너 기본 타임아웃(테스트당) 안에 30초 대기를 넣을 수 없어 ①(탭 닫기·상태 저장)과 ②(재접속)로 나누고,
// 그 사이에 AC-01-34·58 ③을 둔다. ②는 닫은 시각 + 30초까지 남은 만큼만 기다린다(ASM-115 ⑥).
const REOPEN_FILE = join(tmpdir(), "tf-e2e-m5-ac-01-31.json");
test("AC-01-31 ① 생성 중 탭 닫기(잡·세션·닫은 시각 기록)", async ({ page, context }) => {
  needScenario("ok");
  const { jobId } = await userWithJob(page, db);
  await page.goto(`/g/${jobId}`);
  await expect(page.getByTestId("cards")).toBeVisible();
  const state = await context.storageState();
  await page.close();
  writeFileSync(REOPEN_FILE, JSON.stringify({ jobId, closedAt: Date.now(), state }));
});

/** S08 안내 문구 표시 여부. */
const shown = async (
  page: Page,
  key: "drafts.partial" | "drafts.templateCopy" | "drafts.fallback",
) => page.getByText(KO[key], { exact: true }).count();

test("AC-01-58 ① copy_schema_fail@gen_copy: drafts.templateCopy 표시, 머리 상태 partial, 비폴백 3이면 drafts.partial 없음", async ({
  page,
}) => {
  needScenario("copy_schema_fail@gen_copy");
  const { jobId } = await userWithJob(page, db);
  const v = (await waitDone(page, jobId, KILL_S)).body as { status: string; mockups: Mockup[] };
  await page.goto(`/g/${jobId}`);
  await expect(page.getByText(KO["drafts.templateCopy"], { exact: true })).toBeVisible();
  const real = v.mockups.filter((m) => !m.isFallback).length;
  if (real === 3) {
    expect(v.status).toBe("partial");
    expect(await shown(page, "drafts.partial")).toBe(0);
  }
});

test("AC-01-58 ② 비폴백 2 + 폴백 1(cost_ramp): drafts.partial만 표시", async ({ page }) => {
  needScenario("cost_ramp");
  const { jobId } = await userWithJob(page, db);
  const v = (await waitDone(page, jobId, KILL_S)).body as {
    status: string;
    mockups: Mockup[];
    copySource: string;
  };
  expect(v.mockups.filter((m) => !m.isFallback)).toHaveLength(2);
  expect(v.mockups.filter((m) => m.isFallback)).toHaveLength(1);
  expect(v.copySource).toBe("llm");
  await page.goto(`/g/${jobId}`);
  await expect(page.getByText(KO["drafts.partial"], { exact: true })).toBeVisible();
  expect(await shown(page, "drafts.templateCopy")).toBe(0);
  expect(await shown(page, "drafts.fallback")).toBe(0);
});

test('AC-01-34 S08 미리보기 iframe: 다른 등록 도메인, sandbox="", 로드 문서 <script> 0', async ({
  browser,
}) => {
  needScenario("ok");
  const { ctx, page, jobId } = await reopen(browser, "ac-01-34");
  try {
    await waitDone(page, jobId, CHECK_WAIT_S);
    await page.goto(`/g/${jobId}`);
    const frames = page.locator("iframe");
    await expect(frames.first()).toBeVisible();
    const svc = new URL(page.url()).hostname;
    for (const f of await frames.all()) {
      expect(await f.getAttribute("sandbox")).toBe("");
      const host = new URL(String(await f.getAttribute("src")), page.url()).hostname;
      expect(host).not.toBe(svc);
      expect(host.endsWith(`.${svc}`) || svc.endsWith(`.${host}`)).toBe(false);
    }
    for (const fr of page.frames().filter((x) => x !== page.mainFrame())) {
      await fr.waitForLoadState();
      expect(await fr.locator("script").count()).toBe(0);
    }
  } finally {
    await ctx.close();
  }
});
test("AC-01-58 ③ 업종 매칭 0 브리프: photoSubstituted=true인 카드에만 drafts.photoSubstituted", async ({
  browser,
}) => {
  needScenario("ok");
  const { ctx, page, jobId } = await reopen(browser, "ac-01-58-3");
  try {
    const v = (await waitDone(page, jobId, CHECK_WAIT_S)).body as { mockups: Mockup[] };
    expect(v.mockups.some((m) => m.photoSubstituted)).toBe(true);
    await page.goto(`/g/${jobId}`);
    for (const m of v.mockups) {
      const badge = page
        .locator(`article[data-variant=${m.variant}]`)
        .getByText(KO["drafts.photoSubstituted"], { exact: true });
      await expect(badge).toHaveCount(m.photoSubstituted ? 1 : 0);
    }
  } finally {
    await ctx.close();
  }
});

test("AC-01-31 ② 30초 후 /g/[jobId] 재접속: 현재 단계와 확정 카드가 그대로", async ({
  browser,
}) => {
  needScenario("ok");
  const saved = JSON.parse(readFileSync(REOPEN_FILE, "utf8")) as {
    jobId: string;
    closedAt: number;
    state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  };
  const left = saved.closedAt + REOPEN_MS - Date.now();
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  const ctx = await browser.newContext({ storageState: saved.state });
  try {
    const again = await ctx.newPage();
    await again.goto(`/g/${saved.jobId}`);
    const v = (await api(again, "GET", `/api/generations/${saved.jobId}`)).body as {
      status: string;
      mockups: Mockup[];
      pollAfterMs: number | null;
    };
    const ready = again.getByTestId("cards").locator("article[data-ready=true]");
    await expect(ready).toHaveCount(v.mockups.length);
    if (v.pollAfterMs !== null) await expect(again.locator("[aria-current=step]")).toHaveCount(1);
    else await expect(again.getByTestId("steps")).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test("AC-01-51 전역 실행 잡 5건 중 새 요청 → 거부 없이 queued, S07 대기 순번 표시, 폴링마다 순번 단조 감소(증가 0)", async ({
  browser,
}) => {
  needScenario("slow");
  const ctxs: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  const jobs: { page: Page; jobId: string }[] = [];
  try {
    // 테스트당 러너 타임아웃 안에 끝나도록 바쁜 잡 5건을 병렬로 만든다
    const busy = await Promise.all(
      Array.from({ length: BUSY_JOBS }, async () => {
        const c = await browser.newContext();
        ctxs.push(c);
        const p = await c.newPage();
        return { page: p, jobId: (await userWithJob(p, db)).jobId };
      }),
    );
    jobs.push(...busy);
    const mine = await browser.newContext();
    ctxs.push(mine);
    const page = await mine.newPage();
    const { jobId } = await userWithJob(page, db);
    jobs.push({ page, jobId });
    await page.goto(`/g/${jobId}`);
    await expect(page.getByTestId("steps")).toContainText(KO["gen.phase.queued"]);
    const pos: number[] = [];
    for (let i = 0; i < QUEUE_POLLS; i++) {
      const v = (await api(page, "GET", `/api/generations/${jobId}`)).body as {
        status: string;
        queuePosition: number | null;
        pollAfterMs: number | null;
      };
      if (v.status !== "queued") break;
      expect(v.queuePosition).not.toBeNull();
      pos.push(Number(v.queuePosition));
      await page.waitForTimeout(Number(v.pollAfterMs ?? SAMPLE_MS));
    }
    expect(pos.length).toBeGreaterThan(0);
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeLessThanOrEqual(pos[i - 1] ?? 0);
  } finally {
    // 다음 실행에 slow 잡이 남지 않도록 취소한다
    for (const j of jobs)
      await api(j.page, "POST", `/api/generations/${j.jobId}/cancel`, {}).catch(() => undefined);
    for (const c of ctxs) await c.close();
  }
});
