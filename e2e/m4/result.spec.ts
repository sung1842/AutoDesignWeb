// M4 E2E: S03 결과 화면(01장 AC-01-15~19·57, 00장 AC-00-02, 05장 AC-05-10). 결과 픽스처는 serve.ts가 만든 e2e/.results.json.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface Fx {
  anonId: string;
  sessionId: string;
  typeId: string;
  notice: string | null;
}
const FX = (): Record<string, Fx> =>
  JSON.parse(readFileSync("e2e/.results.json", "utf8")) as Record<string, Fx>;
const TYPES = (
  JSON.parse(readFileSync("data/taxonomy/types.json", "utf8")) as {
    items: { id: string; nameKo: string; descriptionKo: string; keywordsKo: string[] }[];
  }
).items;
const KO = readFileSync("apps/web/src/copy/ko.ts", "utf8");
const NOTICE_KEY: Record<string, string> = {
  low_signal: "result.notice.lowSignal",
  conflict: "result.notice.conflict",
  low_consistency: "result.notice.lowConsistency",
  boundary: "result.notice.boundary",
};
const copyOf = (key: string): string =>
  new RegExp(`"${key.replace(/\./g, "\\.")}":\\s*"([^"]+)"`).exec(KO)?.[1] ?? "";

async function open(ctx: BrowserContext, fx: Fx, baseURL: string): Promise<Page> {
  await ctx.addCookies([{ name: "anon_id", value: fx.anonId, url: baseURL }]);
  const page = await ctx.newPage();
  await page.goto(`/d/${fx.sessionId}/result`);
  await expect(page.getByText("나의 디자인 성향 유형")).toBeVisible();
  return page;
}

test("AC-01-16 8유형 결과 화면의 유형 이름·설명·키워드 = 02장 유형 텍스트", async ({
  browser,
  baseURL,
}) => {
  for (const t of TYPES) {
    const ctx = await browser.newContext();
    const page = await open(ctx, FX()[`type-${t.id}`]!, baseURL!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.nameKo);
    await expect(page.getByTestId("type-description")).toHaveText(t.descriptionKo);
    await expect(page.getByTestId("type-keywords")).toHaveText(
      t.keywordsKo.slice(0, 3).join(" · "),
    );
    await ctx.close();
  }
});

test("AC-01-17 · AC-01-18 · AC-05-10 외부 이미지 0, 닮은 사이트 img·배경·svg 0, 링크 nofollow·noopener, 고지, 5행 표, ref-screenshots 0", async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext();
  const bodies: string[] = [];
  const external: string[] = [];
  ctx.on("request", (r) => {
    if (!r.url().startsWith(baseURL!) && r.resourceType() === "image") external.push(r.url());
  });
  ctx.on("response", async (r) => {
    if (r.url().startsWith(baseURL!) && /json|html|text/.test(r.headers()["content-type"] ?? ""))
      bodies.push(await r.text().catch(() => ""));
  });
  const page = await open(ctx, FX()["type-T3"]!, baseURL!);
  const area = page.getByTestId("similar-sites");
  await expect(area.locator("a")).toHaveCount(3);
  await expect(area.locator("img, svg")).toHaveCount(0);
  const bg = await area.evaluate(
    (e) =>
      [e, ...e.querySelectorAll("*")].filter((x) => getComputedStyle(x).backgroundImage !== "none")
        .length,
  );
  expect(bg).toBe(0);
  for (const a of await area.locator("a").all()) {
    const rel = (await a.getAttribute("rel")) ?? "";
    for (const r of ["noopener", "noreferrer", "nofollow"]) expect(rel).toContain(r);
  }
  await expect(page.getByText(copyOf("result.sites.notice"))).toBeVisible();
  await expect(page.locator("table[data-testid=axes-table] tbody tr")).toHaveCount(5);
  expect(external).toEqual([]);
  expect(bodies.join("\n")).not.toContain("ref-screenshots");
  await ctx.close();
});

test("AC-01-57 안내 5종: notice 값에 맞는 문구 0~1개, low_signal·low_consistency는 신뢰도 줄 없음, DOM에 % 0", async ({
  browser,
  baseURL,
}) => {
  for (const n of ["low_signal", "conflict", "low_consistency", "boundary", "null"]) {
    const ctx = await browser.newContext();
    const page = await open(ctx, FX()[`notice-${n}`]!, baseURL!);
    const notes = page.getByRole("note");
    if (n === "null") await expect(notes).toHaveCount(0);
    else {
      await expect(notes).toHaveCount(1);
      const tmpl = copyOf(NOTICE_KEY[n]!).split("{")[0]!;
      await expect(notes).toContainText(tmpl);
    }
    const conf = [
      "result.confidence.high",
      "result.confidence.medium",
      "result.confidence.low",
    ].map(copyOf);
    const has = await Promise.all(conf.map((c) => page.getByText(c, { exact: true }).count()));
    if (n === "low_signal" || n === "low_consistency")
      expect(has.reduce((a, b) => a + b, 0)).toBe(0);
    expect(await page.locator("main").innerText()).not.toContain("%");
    await ctx.close();
  }
});

test("AC-01-19 공감 2점 → 인접 유형 B 선택 → 앵커 = B, 결과 type_id 그대로", async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext();
  const fx = FX()["type-T5"]!;
  const page = await open(ctx, fx, baseURL!);
  await page.getByRole("radio").nth(1).check();
  const panel = page.getByText(copyOf("result.adjacent.q"));
  await expect(panel).toBeVisible();
  const before = (await (await ctx.request.get(`/api/surveys/${fx.sessionId}/result`)).json()) as {
    type: { id: string };
    adjacentTypes: { id: string; nameKo: string }[];
  };
  const b = before.adjacentTypes[0]!;
  await page.getByRole("button", { name: b.nameKo }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(b.nameKo);
  const after = (await (await ctx.request.get(`/api/surveys/${fx.sessionId}/result`)).json()) as {
    type: { id: string };
    anchorOverrideTypeId: string;
  };
  expect(after.anchorOverrideTypeId).toBe(b.id);
  expect(after.type.id).toBe(before.type.id);
  await ctx.close();
});

test("AC-00-02 · AC-01-15 랜딩에 1차 타깃·산출물 명시, 사용자 노출 문자열(copy·빌드 산출물)에 MBTI·이모지 0", async ({
  page,
}) => {
  await page.goto("/");
  const body = await page.locator("body").innerText();
  for (const kw of [
    "시안 3개",
    "코드",
    "내보내기",
    "포트폴리오·개인 브랜드",
    "카페·식당·공방",
    "SaaS·앱 소개",
  ])
    expect(body).toContain(kw);
  const EMOJI = /\p{Extended_Pictographic}/u;
  expect(KO).not.toContain("MBTI");
  expect(EMOJI.test(KO)).toBe(false);
  const hits: string[] = [];
  const walk = (d: string): void => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(html|rsc|js)$/.test(n)) {
        const s = readFileSync(p, "utf8");
        if (s.includes("MBTI")) hits.push(p);
      }
    }
  };
  walk("apps/web/.next/static");
  walk("apps/web/.next/server/app");
  expect(hits).toEqual([]);
});
