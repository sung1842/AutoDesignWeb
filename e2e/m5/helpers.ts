// e2e/m5 공용: 브라우저 안 fetch(쿠키·Origin을 브라우저와 같게)로 진단·프로젝트·생성을 만들고, 로그인·동의는 화면으로 한다.
// 계약: ASSUMPTIONS ASM-113·ASM-115.
import { expect, type Page } from "@playwright/test";
import type { DbPort } from "../../packages/db/src/index.js";
import { latestMagicLink } from "../../packages/db/src/testing/fixtures.js";

export const DB = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_e2e";

export interface ApiRes {
  status: number;
  body: Record<string, unknown>;
}
/** 같은 오리진 fetch를 페이지 안에서 실행한다. */
export async function api(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiRes> {
  return page.evaluate(
    async ({ method, path, body, headers }) => {
      const h: Record<string, string> = { ...headers };
      if (method !== "GET") h["content-type"] = "application/json";
      const r = await fetch(path, {
        method,
        headers: h,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const t = await r.text();
      return { status: r.status, body: t.startsWith("{") ? JSON.parse(t) : {} };
    },
    { method, path, body, headers },
  );
}

type View = {
  id: string;
  resultId: string | null;
  question: { seq: number; itemKey: string; items: string[] } | null;
};
/** 익명 진단을 API로 끝까지 진행하고 resultId를 돌려준다(현재 페이지가 서비스 오리진이어야 한다). */
export async function surveyViaApi(page: Page): Promise<string> {
  let v = (await api(page, "POST", "/api/surveys", { entry: "landing" })).body as unknown as View;
  while (v.question)
    v = (
      await api(page, "POST", `/api/surveys/${v.id}/responses`, {
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

/** S04 로그인(매직링크는 dev_mail_outbox 픽스처) → 첫 동의(S05). 끝나면 next로 간다. */
export async function loginAndConsent(page: Page, db: DbPort, next = "/me"): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();
  await expect(page.getByTestId("sent")).toContainText(email);
  await page.goto(await latestMagicLink(db, email));
  await expect(page).toHaveURL(/\/onboarding\/consent\?next=/);
  await page.getByLabel("만 14세 이상입니다.").check();
  await page.getByLabel(/이용약관/).check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).not.toHaveURL(/\/onboarding\/consent/);
  return email;
}

export const BRAND = {
  name: "온결 베이커리",
  description: "망원동에서 매일 아침 굽는 사워도우 빵집",
  primaryAction: "reserve",
  keyPoints: ["매일 아침 굽는 빵", "천연 발효종"],
};

/**
 * 이 실행의 Mock 시나리오(9.6.2 MOCK_LLM_SCENARIO env). next start는 NODE_ENV=production이라 요청 헤더
 * x-mock-scenario를 쓸 수 없으므로, 시나리오가 필요한 테스트는 브리지(tests/acceptance/m5/ui.test)가 env를 주고 -g로 따로 돌린다(ASM-115 ⑪).
 */
export function needScenario(name: string): void {
  expect(process.env.MOCK_LLM_SCENARIO ?? "ok", "MOCK_LLM_SCENARIO").toBe(name);
}

/** 로그인·동의를 마친 사용자 1명 + 프로젝트 → 생성 요청. 잡은 serve.ts 워커가 돈다. */
export async function userWithJob(
  page: Page,
  db: DbPort,
  brand: Record<string, unknown> = BRAND,
): Promise<{ jobId: string; projectId: string }> {
  await page.goto("/");
  const resultId = await surveyViaApi(page);
  await loginAndConsent(page, db);
  const p = await api(page, "POST", "/api/projects", {
    resultId,
    purpose: "local_business",
    brand,
    useSampleContent: false,
  });
  expect(p.status, JSON.stringify(p.body)).toBe(201);
  const projectId = String(p.body.projectId);
  const g = await api(
    page,
    "POST",
    `/api/projects/${projectId}/generations`,
    { kind: "initial" },
    { "idempotency-key": `k_${crypto.randomUUID()}` },
  );
  expect(g.status, JSON.stringify(g.body)).toBe(202);
  return { jobId: String(g.body.jobId), projectId };
}

/** 잡이 종료 상태가 될 때까지 GET 폴링(pollAfterMs). */
export async function waitDone(page: Page, jobId: string, limitS: number): Promise<ApiRes> {
  const until = Date.now() + limitS * 1000;
  for (;;) {
    const r = await api(page, "GET", `/api/generations/${jobId}`);
    if (r.body.pollAfterMs === null || Date.now() > until) return r;
    await page.waitForTimeout(Number(r.body.pollAfterMs ?? 1000));
  }
}
