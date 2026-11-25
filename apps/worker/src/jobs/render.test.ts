import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadDesignData, standardTree } from "@tastefit/design-spec";
import { compilePage } from "@tastefit/renderer";
import { openHarness, type Harness } from "../render/harness.js";
import { runRenderJob } from "./render.js";

const data = loadDesignData(new URL("../../../..", import.meta.url).pathname);
let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("render 잡(D-25, 06장 6.8.3, M2-10)", () => {
  it("뷰포트 5장 PNG, 정상 시안 차단 0, 조작 HTML은 차단 ≥ 1·외부 요청 0", async () => {
    const { spec, tree } = standardTree("T2", "saas", data);
    const html = compilePage(spec, tree, data).html;
    const ok = await runRenderJob({ html }, h);
    expect(ok.screenshots.map((s) => s.viewport)).toEqual([375, 768, 1024, 1280, 1920]);
    for (const s of ok.screenshots) expect(s.png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(ok.renderBlockedRequests).toBe(0);
    const bad = await runRenderJob(
      {
        html: html.replace(
          "</body>",
          '<img src="https://example.com/x.png" width="1" height="1" alt=""></body>',
        ),
      },
      h,
    );
    expect(bad.externalRequests).toEqual([]);
    expect(bad.renderBlockedRequests).toBeGreaterThanOrEqual(1);
  });
});
