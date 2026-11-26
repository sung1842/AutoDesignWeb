// e2e(07장 7.1 L2 시각 회귀). 기준 이미지는 렌더 환경 지문별 폴더(09장 9.4.1 S-02, D-0910).
// maxDiffPixelRatio는 config/test-policy.json에서만 읽는다(테스트 파일 재지정 금지, 07장 7.3).
import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import { renderEnvId } from "./e2e/render-env.js";

const policy = JSON.parse(readFileSync("config/test-policy.json", "utf8")) as {
  visual: { maxDiffPixelRatio: number };
};
export const RENDER_ENV_ID = process.env.RENDER_ENV_ID ?? renderEnvId();

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  snapshotPathTemplate: `e2e/__screenshots__/${RENDER_ENV_ID}/{testFileName}/{arg}{ext}`,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: policy.visual.maxDiffPixelRatio, animations: "disabled" },
  },
  projects: [{ name: "chromium" }],
});
