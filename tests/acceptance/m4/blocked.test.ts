// M4 수용 테스트 중 잠금 충돌로 지금 만족할 수 없는 항목(BLOCKED.md BLK-023·024). 사람이 배정표·러너를 고치면 녹색이 되어야 한다.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { planFor } from "../../../scripts/verify/plan.js";
import { ROOT } from "../_support/sh.js";

describe("AC-01-20 공개 보기(BLK-023)", () => {
  it("AC-01-20 공개 결과 화면 /r/[shareId]와 GET /api/share/:shareId가 있다", () => {
    expect(existsSync(join(ROOT, "apps/web/src/app/r/[shareId]/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "apps/web/src/app/api/share/[shareId]/route.ts"))).toBe(true);
  });
});

describe("AC-09-19 survey-items-count 단계(BLK-024)", () => {
  it("AC-09-19 verify:m4 계획에 survey-items-count(blockable) 단계가 있다", () => {
    expect(planFor("m4")).toContain("survey-items-count");
  });
});
