// e2e/m4 공용: 기기별 응답 방식(01장 1.4.3, ASM-100 식별자).
import { expect, type Page } from "@playwright/test";

/** 현재 문항에 1개 응답한다(기기별 방식, 1.4.3). 응답 후 다음 문항 또는 결과로 바뀔 때까지 기다린다. */
export async function answerOne(page: Page, pick: number): Promise<"next" | "done"> {
  const q = page.getByTestId("question");
  await expect(q).toBeVisible();
  const seq = await q.getAttribute("data-seq");
  const kind = await q.getAttribute("data-kind");
  const layout = await q.getAttribute("data-layout");
  const k = kind === "ab" ? pick % 2 : pick % 4;
  if (layout === "pager") {
    await page.getByRole("button", { name: `카드 ${k + 1} 보기` }).click();
    await page.getByRole("button", { name: "이걸로 할게요" }).click();
  } else if (layout === "toggle") {
    await page.getByRole("button", { name: "B", exact: true }).click();
    await page.getByRole("button", { name: "A", exact: true }).click();
    await page.getByRole("button", { name: k === 0 ? "A로 할게요" : "B로 할게요" }).click();
  } else {
    const label = kind === "ab" ? (k === 0 ? "A" : "B") : `선택지 ${k + 1}`;
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await expect(async () => {
    const cont = page.getByRole("button", { name: "계속하기" });
    if (await cont.isVisible()) await cont.click();
    const now = page.getByTestId("question");
    const done = page.url().includes("/result");
    expect(done || (await now.getAttribute("data-seq").catch(() => seq)) !== seq).toBe(true);
  }).toPass();
  return page.url().includes("/result") ? "done" : "next";
}
