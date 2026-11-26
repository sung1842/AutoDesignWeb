// M4 E2E: S02 진단 화면 규칙(01장 AC-01-04·05·06·07·08·10·11·12·55, 1.4.2~1.4.9). 서버·데이터는 serve.ts(ASM-100).
import { expect, test, type Page } from "@playwright/test";
import { answerOne } from "./helpers.js";

async function start(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "진단 시작" }).click();
  await expect(page.getByTestId("question")).toBeVisible();
}
const seqOf = async (page: Page): Promise<number> =>
  Number(await page.getByTestId("question").getAttribute("data-seq"));

test("AC-01-04 이전 문항 사용 후 재응답 전 브라우저 뒤로 → 같은 문항에 머물고 토스트 1회", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  for (const i of [0, 1, 2, 3, 4]) await answerOne(page, i);
  expect(await seqOf(page)).toBe(6);
  await page.getByRole("button", { name: "← 이전 문항" }).click();
  await expect(page.getByTestId("question")).toHaveAttribute("data-seq", "5");
  await page.goBack();
  await expect(page.getByTestId("question")).toHaveAttribute("data-seq", "5");
  await expect(page).toHaveURL(/\/d\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("status").filter({ hasText: "한 문항만 돌아갈 수 있어요" }),
  ).toHaveCount(1);
});

test("AC-01-05 · AC-01-06 끝까지 16문항 이내, 진행률 막대 폭 단조 비감소(이전 문항 포함)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  const widths: number[] = [];
  const fill = page.getByTestId("progress-fill");
  let n = 0;
  let undone = false;
  for (;;) {
    widths.push((await fill.boundingBox())?.width ?? 0);
    if (n === 3 && !undone) {
      undone = true;
      await page.getByRole("button", { name: "← 이전 문항" }).click();
      await expect(page.getByTestId("question")).toHaveAttribute("data-seq", "3");
      widths.push((await fill.boundingBox())?.width ?? 0);
      n--;
    }
    if ((await answerOne(page, n)) === "done") break;
    n++;
    expect(n).toBeLessThanOrEqual(16);
  }
  for (const [i, w] of widths.entries())
    if (i > 0) expect(w, `막대 ${i}`).toBeGreaterThanOrEqual(widths[i - 1]!);
});

test("AC-01-07 한 문항 이미지 표시 시작 시각 차이 ≤ 16ms", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    const w = window as unknown as { __shown: Record<string, number> };
    w.__shown = {};
    const tick = () => {
      for (const img of document.querySelectorAll<HTMLImageElement>("[data-testid=question] img"))
        if (img.complete && img.naturalWidth > 0 && !(img.src in w.__shown))
          w.__shown[img.src] = performance.now();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await start(page);
  await expect(page.locator("[data-testid=question] img")).toHaveCount(4);
  await page.waitForTimeout(300);
  const t = Object.values(
    await page.evaluate(() => (window as unknown as { __shown: Record<string, number> }).__shown),
  );
  expect(t).toHaveLength(4);
  expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(16);
});

test("AC-01-08 360px에서 1·2단계 카드 표시 폭 ≥ 328px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await start(page);
  const widthNow = async () => (await page.locator(".svc-card").first().boundingBox())?.width ?? 0;
  expect(await widthNow()).toBeGreaterThanOrEqual(328);
  let n = 0;
  while ((await page.getByTestId("question").getAttribute("data-kind")) !== "ab") {
    if ((await answerOne(page, n++)) === "done") break;
  }
  if ((await page.getByTestId("question").getAttribute("data-kind")) === "ab")
    expect(await widthNow()).toBeGreaterThanOrEqual(328);
});

test("AC-01-10 문항 6 응답 후 탭 닫기 → S01 배너 16문항 중 6문항 완료 → 이어서 하기 = 문항 7", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page);
  for (const i of [0, 1, 2, 3, 4, 5]) await answerOne(page, i);
  await page.close();
  const again = await context.newPage();
  await again.goto("/");
  await expect(again.getByText("16문항 중 6문항 완료")).toBeVisible();
  await again.getByRole("button", { name: "이어서 하기" }).click();
  await expect(again.getByTestId("question")).toHaveAttribute("data-seq", "7");
});

test("AC-01-11 mobile 2단계에서 B를 보지 않으면 세 응답 버튼 비활성", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  let n = 0;
  while ((await page.getByTestId("question").getAttribute("data-kind")) !== "ab")
    if ((await answerOne(page, n++)) === "done") break;
  await expect(page.getByTestId("question")).toHaveAttribute("data-layout", "toggle");
  for (const name of ["A로 할게요", "B로 할게요", "차이를 모르겠어요"])
    await expect(page.getByRole("button", { name }), name).toBeDisabled();
  await page.getByRole("button", { name: "B", exact: true }).click();
  await expect(page.getByRole("button", { name: "A로 할게요" })).toBeEnabled();
});

test("AC-01-12 이미지 1장 로드 실패 → 대체 텍스트 표시, 그 카드 선택·다음 문항 진행 가능", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let failed = "";
  await page.route("**/api/_storage/public/**", async (route) => {
    if (!failed) failed = route.request().url();
    if (route.request().url() === failed) return route.abort();
    return route.continue();
  });
  await start(page);
  const alt = page.locator("[data-testid=question] .svc-card__alt");
  await expect(alt).toHaveCount(1);
  await expect(alt).toContainText("선택지");
  const card = page.locator("[data-testid=question] button.svc-card", {
    has: page.locator(".svc-card__alt"),
  });
  await card.click();
  await expect(page.getByTestId("question")).toHaveAttribute("data-seq", "2");
});

const LAYOUT_CASES: { vp: [number, number]; stage1: string; stage2: string }[] = [
  { vp: [768, 1024], stage1: "list1", stage2: "toggle" },
  { vp: [1024, 768], stage1: "list1", stage2: "toggle" },
  { vp: [1280, 720], stage1: "grid2x2", stage2: "pair" },
  { vp: [1366, 657], stage1: "grid2x2", stage2: "pair" },
];
test("AC-01-55 ① 360·390·412 mobile: 응답 버튼·보조 선택지가 스크롤 없이 보이고 카드 안 스크롤 0", async ({
  browser,
}) => {
  for (const [w, h] of [
    [360, 640],
    [390, 664],
    [412, 780],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await start(page);
    for (const name of ["이걸로 할게요", "다 별로예요"]) {
      const b = (await page.getByRole("button", { name }).boundingBox())!;
      expect(b.y + b.height, `${w}×${h} ${name}`).toBeLessThanOrEqual(h);
    }
    const card = page.locator(".svc-card").first();
    expect(await card.evaluate((e) => e.scrollHeight === e.clientHeight)).toBe(true);
    await ctx.close();
  }
});
test("AC-01-55 ② 768~1366: 카드 폭 ≥ 480·layoutMode = 1.4.3 표", async ({ browser }) => {
  for (const c of LAYOUT_CASES) {
    const ctx = await browser.newContext({ viewport: { width: c.vp[0], height: c.vp[1] } });
    const page = await ctx.newPage();
    await start(page);
    await expect(page.getByTestId("question")).toHaveAttribute("data-layout", c.stage1);
    expect((await page.locator(".svc-card").first().boundingBox())!.width).toBeGreaterThanOrEqual(
      480,
    );
    let n = 0;
    while ((await page.getByTestId("question").getAttribute("data-kind")) !== "ab")
      if ((await answerOne(page, n++)) === "done") break;
    await expect(page.getByTestId("question")).toHaveAttribute("data-layout", c.stage2);
    expect((await page.locator(".svc-card").first().boundingBox())!.width).toBeGreaterThanOrEqual(
      480,
    );
    await ctx.close();
  }
});
test("AC-01-55 ③ 844×390 터치: 회전 안내 표시·응답 버튼 비활성", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await start(page);
  await expect(page.getByText("세로로 돌려 주세요")).toBeVisible();
  await expect(page.getByRole("button", { name: "다 별로예요" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^선택지 \d$/ })).toHaveCount(0);
  await ctx.close();
});
test("AC-01-55 ④ mobile 썸네일 탭만으로 4장 모두 보고 선택", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const items = ((await page.getByTestId("question").getAttribute("data-items")) ?? "").split(",");
  const seen: string[] = [];
  for (const i of [1, 2, 3, 4]) {
    await page.getByRole("button", { name: `카드 ${i} 보기` }).click();
    await expect(page.getByRole("button", { name: `카드 ${i} 보기` })).toHaveAttribute(
      "aria-current",
      "true",
    );
    seen.push(items[i - 1]!);
  }
  expect(seen).toEqual(items);
  await page.getByRole("button", { name: "이걸로 할게요" }).click();
  await expect(page.getByTestId("question")).toHaveAttribute("data-seq", "2");
});
