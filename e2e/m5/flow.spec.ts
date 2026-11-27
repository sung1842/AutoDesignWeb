// M5 E2E(09장 9.4.7 ①, 01장 AC-01-02·24·27·33, 06장 AC-06-15): 익명 진단 → 결과 CTA → 브리프(S06) → 로그인 게이트(S04, 매직링크는
// dev_mail_outbox 픽스처 함수로 읽음, 6.5.2) → 첫 동의(S05) → S06 복귀·자동 제출(추가 클릭 0) → S07 → S08 시안 3개.
// 서버 = e2e/serve.ts(web + worker 소비 루프). 화면 계약은 ASSUMPTIONS ASM-113.
import { expect, test } from "@playwright/test";
import { createDbPort } from "../../packages/db/src/index.js";
import { latestMagicLink } from "../../packages/db/src/testing/fixtures.js";
import { thresholdNumber } from "../../packages/config/src/index.js";
import { answerOne } from "../m4/helpers.js";

const DB = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_e2e";
const CARDS_S = thresholdNumber("perf.mockE2eSubmitToCardsSec");

test("9.4.7 ① 익명 진단 → 로그인·동의 → 자동 제출 → 시안 3개(v_true·v_fit·v_bal, 라벨·AI 배지)", async ({
  page,
}) => {
  const db = createDbPort(DB);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "진단 시작" }).click();
    let n = 0;
    while ((await answerOne(page, n)) === "next") n++;
    await page.getByRole("button", { name: "이 취향으로 내 사이트 시안 만들기" }).click();
    await expect(page).toHaveURL(/\/brief\?result=/);
    // AC-01-27: 연락처·주소·사업자번호·파일 업로드 입력 0, 개인정보 안내·AI 고지 존재
    await expect(
      page.locator("input[type=tel], input[type=file], input[name*=phone], input[name*=address]"),
    ).toHaveCount(0);
    await expect(page.getByTestId("ai-notice")).toBeVisible();
    // AC-01-24: 필수 무효면 제출 시 필드 오류
    await page.getByRole("button", { name: "시안 만들기" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.getByRole("button", { name: "카페·식당·공방" }).click();
    await page.getByLabel("브랜드 이름").fill("온결 베이커리");
    await page.getByLabel("한 줄 소개").fill("망원동에서 매일 아침 굽는 사워도우 빵집");
    await page.getByLabel("예약하기").check();
    await page.getByRole("button", { name: "시안 만들기" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    const email = `e2e-${Date.now()}@example.com`;
    await page.getByLabel("이메일").fill(email);
    await page.getByRole("button", { name: "로그인 링크 받기" }).click();
    await expect(page.getByTestId("sent")).toContainText(email);
    await page.goto(await latestMagicLink(db, email));
    await expect(page).toHaveURL(/\/onboarding\/consent\?next=/);
    const start = page.getByRole("button", { name: "시작하기" });
    await expect(start).toBeDisabled();
    await page.getByLabel("만 14세 이상입니다.").check();
    await page.getByLabel(/이용약관/).check();
    await start.click();
    // AC-01-02: S06 복귀 → 입력 보존 → 자동 제출(추가 클릭 0) → /g/[jobId]
    const t0 = Date.now();
    await expect(page).toHaveURL(/\/g\/[0-9a-f-]{36}$/);
    const cards = page.getByTestId("cards").locator("article[data-ready=true]");
    await expect(cards).toHaveCount(3, { timeout: CARDS_S * 1000 });
    expect((Date.now() - t0) / 1000).toBeLessThanOrEqual(CARDS_S);
    for (const [v, label] of [
      ["v_true", "취향 그대로"],
      ["v_fit", "용도 최적"],
      ["v_bal", "균형"],
    ]) {
      const card = page.locator(`article[data-variant=${v}]`);
      await expect(card.getByRole("heading")).toHaveText(label);
      // AC-01-33 AI 생성 배지
      await expect(card.getByLabel("AI로 생성된 시안")).toBeVisible();
    }
  } finally {
    await db.close();
  }
});
