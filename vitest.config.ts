import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    retry: 0,
    // 러너 타임아웃은 이 한 곳에만 둔다(판정 기준 아님, ASM-004). guard·스택 수용 테스트가 임시 저장소를 재현한다.
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
