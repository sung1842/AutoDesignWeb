// M4 E2E(09장 9.4.6 ⑧⑨⑩, 01장 1.4·1.5.2, AC-00-03, AC-01-17·18). 서버는 playwright.config webServer(e2e/serve.ts:
// 전용 DB 초기화 + 설문 픽스처(전부 active) + 닮은 사이트 픽스처 + next build/start). 화면 계약은 ASSUMPTIONS ASM-100.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const NOTICE =
  "디자인 특징이 비슷한 공개 웹사이트예요. 취향핏과 제휴 관계가 없으며, 생성 시안은 이 사이트들을 복제하지 않아요. 각 사이트의 상표와 콘텐츠는 해당 권리자에게 있어요.";
const TYPE_NAMES = (
  JSON.parse(readFileSync("data/taxonomy/types.json", "utf8")) as { items: { nameKo: string }[] }
).items.map((t) => t.nameKo);

/** 현재 문항에 1개 응답한다(기기별 방식, 1.4.3). 응답 후 다음 문항 또는 결과로 바뀔 때까지 기다린다. */
async function answerOne(page: Page, pick: number): Promise<"next" | "done"> {
  const q = page.getByTestId("question");
  await expect(q).toBeVisible();
  const seq = await q.getAttribute("data-seq");
  const kind = await q.getAttribute("data-kind");
  const layout = await q.getAttribute("data-layout");
  if (layout === "pager") {
    await page.getByRole("button", { name: `카드 ${pick + 1} 보기` }).click();
    await page.getByRole("button", { name: "이걸로 할게요" }).click();
  } else if (layout === "toggle") {
    await page.getByRole("button", { name: "B", exact: true }).click();
    await page.getByRole("button", { name: "A", exact: true }).click();
    await page.getByRole("button", { name: pick % 2 === 0 ? "A로 할게요" : "B로 할게요" }).click();
  } else {
    const label = kind === "ab" ? (pick % 2 === 0 ? "A" : "B") : `선택지 ${pick + 1}`;
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

for (const vp of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
]) {
  test(`⑧ ${vp.width}×${vp.height}: 익명 진단 완료 → 유형명·5축·닮은 사이트 3·비제휴 고지`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const external: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith("http://localhost:") && r.resourceType() === "image")
        external.push(r.url());
    });
    await page.goto("/");
    for (const kw of ["4분", "무료", "로그인 없이", "시안 3개", "코드"])
      await expect(page.locator("body"), `AC-00-03 ${kw}`).toContainText(kw);
    await page.getByRole("button", { name: "진단 시작" }).click();
    await expect(page).toHaveURL(/\/d\/[0-9a-f-]{36}$/);
    let n = 0;
    while ((await answerOne(page, n)) === "next") n++;
    await expect(page).toHaveURL(/\/d\/[0-9a-f-]{36}\/result$/);
    await expect(page.getByText("나의 디자인 성향 유형")).toBeVisible();
    const h1 = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    expect(TYPE_NAMES).toContain(h1.trim());
    await expect(page.locator("table[data-testid=axes-table] tbody tr")).toHaveCount(5);
    const links = page.locator("[data-testid=similar-sites] a");
    await expect(links).toHaveCount(3);
    for (const a of await links.all()) {
      const rel = (await a.getAttribute("rel")) ?? "";
      for (const r of ["noopener", "noreferrer", "nofollow"]) expect(rel).toContain(r);
      expect(await a.getAttribute("target")).toBe("_blank");
    }
    await expect(page.locator("[data-testid=similar-sites] img")).toHaveCount(0);
    await expect(page.getByText(NOTICE)).toBeVisible();
    expect(external).toEqual([]);
    await ctx.close();
  });
}

test("⑨ 새로고침 후 같은 문항에서 재개, 뒤로가기 1회 후 다른 응답이면 벡터 재계산", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "진단 시작" }).click();
  await answerOne(page, 0);
  await answerOne(page, 1);
  const q = page.getByTestId("question");
  const seq = await q.getAttribute("data-seq");
  const items = await q.getAttribute("data-items");
  await page.reload();
  await expect(page.getByTestId("question")).toHaveAttribute("data-seq", seq ?? "");
  await expect(page.getByTestId("question")).toHaveAttribute("data-items", items ?? "");
  const before = (await (await ctx.request.get("/api/surveys/current")).json()) as {
    state: { mu: number[] };
  };
  await page.getByRole("button", { name: "← 이전 문항" }).click();
  await expect(page.getByTestId("question")).toHaveAttribute("data-seq", String(Number(seq) - 1));
  await expect(page.getByRole("button", { name: "← 이전 문항" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await answerOne(page, 3);
  const after = (await (await ctx.request.get("/api/surveys/current")).json()) as {
    state: { mu: number[] };
  };
  expect(after.state.mu).not.toEqual(before.state.mu);
  await ctx.close();
});

test('⑩ 빌드 산출물(.next) 화면 텍스트에 "MBTI" 0건', () => {
  const hits: string[] = [];
  const walk = (d: string): void => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (n === "cache") continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(html|js|json|rsc|txt)$/.test(n) && readFileSync(p, "utf8").includes("MBTI"))
        hits.push(p);
    }
  };
  walk("apps/web/.next");
  expect(hits).toEqual([]);
});
