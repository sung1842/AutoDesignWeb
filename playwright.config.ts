// e2e(07장 7.1 L2 시각 회귀). 기준 이미지는 렌더 환경 지문별 폴더(09장 9.4.1 S-02, D-0910).
// maxDiffPixelRatio는 config/test-policy.json에서만 읽는다(테스트 파일 재지정 금지, 07장 7.3).
import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import { renderEnvId } from "./e2e/render-env.js";

const policy = JSON.parse(readFileSync("config/test-policy.json", "utf8")) as {
  visual: { maxDiffPixelRatio: number };
};
export const RENDER_ENV_ID = process.env.RENDER_ENV_ID ?? renderEnvId();
/** M4 이후 E2E는 웹 서버가 필요하다(e2e/serve.ts, ASM-100). e2e/m0~m3만 고른 실행에서는 띄우지 않는다. */
const dirs = process.argv.filter((a) => a.startsWith("e2e/"));
const needWeb = dirs.length === 0 || dirs.some((d) => !/^e2e\/m[0-3](\/|$)/.test(d));
const E2E_PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  snapshotPathTemplate: `e2e/__screenshots__/${RENDER_ENV_ID}/{testFileName}/{arg}{ext}`,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: policy.visual.maxDiffPixelRatio,
      animations: "disabled",
    },
  },
  projects: [{ name: "chromium" }],
  use: { baseURL: `http://localhost:${E2E_PORT}` },
  ...(needWeb
    ? {
        webServer: {
          command: "pnpm exec tsx e2e/serve.ts",
          url: `http://localhost:${E2E_PORT}/`,
          reuseExistingServer: false,
          // 서버 준비(DB 초기화·next build) 대기 상한. 테스트 타임아웃이 아니다
          timeout: 600_000,
          stdout: "pipe",
        },
      }
    : {}),
});
