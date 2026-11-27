// M5 수용 테스트(10): 워커 폴백 경로의 결정론 폴백 72조합(유형 8 × 용도 3 × 변형 3) 품질(04장 4.12, AC-04-25).
// M3 골격 폴백(tests/acceptance/m3/golden.test)과 달리 워커와 같은 buildFallback(브랜드 카피 포함)으로 만든다. 계약: ASM-117.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFallback, loadDesignData } from "../../../packages/design-spec/src/index.js";
import { compilePage } from "../../../packages/renderer/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { evaluateCandidate } from "../../../apps/worker/src/quality/evaluate.js";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT } from "../_support/sh.js";

const data = loadDesignData(ROOT);
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
const H_FLOOR = thresholdNumber("generation.harmonyFloor");
const GATES = Array.from({ length: 13 }, (_, i) => `G-${String(i + 1).padStart(2, "0")}`);
/** 용도별 대표 브랜드(BrandInput, 01장 1.5.5.2). */
const BRANDS: Record<(typeof PURPOSES)[number], Record<string, unknown>> = {
  saas: {
    name: "모아노트",
    description: "업무를 더 빠르게 끝내도록 돕는 서비스입니다",
    primaryAction: "signup",
    keyPoints: ["회의록 자동 정리", "할 일 바로 공유"],
  },
  local_business: {
    name: "온결 베이커리",
    description: "망원동에서 매일 아침 굽는 사워도우 빵집",
    primaryAction: "reserve",
    keyPoints: ["매일 아침 굽는 빵", "천연 발효종"],
  },
  portfolio: {
    name: "김서윤 사진",
    description: "사람과 공간의 빛을 담는 사진가",
    primaryAction: "contact",
    keyPoints: ["인물 촬영", "공간 촬영"],
  },
};

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("AC-04-25 워커 폴백 72조합: G-01~G-13 통과, H ≥ harmonyFloor", () => {
  let n = 0;
  const allBad: string[] = [];
  for (const t of TYPES)
    it(`AC-04-25 폴백 ${t} × 용도 3 × 변형 3(브랜드 카피)`, async () => {
      const bad: string[] = [];
      for (const p of PURPOSES)
        for (const v of VARIANTS) {
          const { spec, tree } = buildFallback(
            { typeId: t, purpose: p, variant: v, brand: BRANDS[p] },
            data,
          );
          const { html } = compilePage(spec, tree, data);
          const { report } = await evaluateCandidate(h, { spec, tree, html }, data, {
            fallback: true,
          });
          expect(report.hard.map((g) => g.id).sort()).toEqual(GATES);
          const fg = report.hard.filter((g) => g.status !== "pass").map((g) => g.id);
          if (fg.length) bad.push(`${t}/${p}/${v} gates ${fg.join(",")}`);
          if (report.harmony < H_FLOOR) bad.push(`${t}/${p}/${v} H ${report.harmony}`);
          n++;
        }
      allBad.push(...bad);
      expect(bad).toEqual([]);
    });
  it("AC-04-25 폴백 72조합 전부 G-01~G-13 통과·H ≥ harmonyFloor(평가 조합 수 72)", () => {
    expect(n).toBe(TYPES.length * PURPOSES.length * VARIANTS.length);
    expect(allBad).toEqual([]);
  });
});
