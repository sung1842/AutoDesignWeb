// 09장 9.4.4 ⑤·07장 7.1 시각 회귀(렌더러): 프리셋 8 × 대표 페이지 3 = 24장, 1280×800 뷰포트 전체 페이지.
// 대표 페이지 = 용도별 패턴 1 픽스처(fixtures/layouts *-p?1-00). 해석은 ASSUMPTIONS ASM-071.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadDesignData } from "../../packages/design-spec/src/index.js";
import { compilePage, fixturePage } from "../../packages/renderer/src/index.js";
import { openHarness, type Harness } from "../../apps/worker/src/render/harness.js";

const ROOT = join(import.meta.dirname, "../..");
const data = loadDesignData(ROOT);
const PAGES = ["saas-ps1-00", "local-business-pl1-00", "portfolio-pp1-00"] as const;
const VW = 1280;

let h: Harness;
test.beforeAll(async () => {
  h = await openHarness();
});
test.afterAll(async () => {
  await h.close();
});

for (const preset of data.presets) {
  for (const name of PAGES) {
    test(`${preset.id} × ${name}`, async () => {
      const fx = JSON.parse(readFileSync(join(ROOT, "fixtures/layouts", `${name}.json`), "utf8"));
      const { spec, tree } = fixturePage(fx, data, { presetId: preset.id });
      const { html } = compilePage(spec as never, tree as never, data);
      await h.withPage(html, VW, async (p) => {
        await expect(p as unknown as Page).toHaveScreenshot(`${preset.id}-${name}.png`, {
          fullPage: true,
        });
      });
    });
  }
}
