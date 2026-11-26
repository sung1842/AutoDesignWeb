import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";
import {
  altOk,
  cardPoolOk,
  coverageIssues,
  judgeCard,
  judgePair,
  stage1Issues,
  type CheckCard,
} from "./stimuli.js";

const ROOT = findRepoRoot();
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
const TYPES = read<{ items: { id: string; centroid: number[] }[] }>(
  "data/taxonomy/types.json",
).items;
const PLAN: CheckCard[] = read<{
  items: { id: string; svId: string; templateId: string; targetL1: number[] }[];
}>("data/survey/card_plan.json").items.map((c) => ({
  id: c.id,
  sv: c.svId,
  template: c.templateId,
  x: c.targetL1,
}));

describe("stimuli 판정", () => {
  it("judgeCard: 0.15 초과 축이 있으면 실패, within은 0.10 이내 축 수", () => {
    const t = [0.5, 0.5, 0.5, 0.5, 0.5];
    expect(judgeCard(t, [0.55, 0.5, 0.5, 0.5, 0.5]).ok).toBe(true);
    const j = judgeCard(t, [0.66, 0.62, 0.5, 0.5, 0.5]);
    expect(j.ok).toBe(false);
    expect(j.within).toBe(3);
    expect(cardPoolOk([j]).ok).toBe(false);
  });
  it("judgePair: 부호·크기·비대상 축", () => {
    const a = [0.2, 0.5, 0.5, 0.5, 0.5];
    expect(judgePair("A1", [0.2, 0.5], a, [0.4, 0.52, 0.5, 0.5, 0.5]).ok).toBe(true);
    expect(judgePair("A1", [0.2, 0.5], a, [0.3, 0.5, 0.5, 0.5, 0.5]).ok).toBe(false);
    expect(judgePair("A1", [0.2, 0.5], a, [0.4, 0.6, 0.5, 0.5, 0.5]).ok).toBe(false);
    expect(judgePair("A1", [0.2, 0.5], a, [0.0, 0.5, 0.5, 0.5, 0.5]).ok).toBe(false);
  });
  it("계획 target 48장은 커버리지·1단계 후보 통과", () => {
    expect(coverageIssues(PLAN, TYPES)).toEqual([]);
    expect(stage1Issues(PLAN, TYPES)).toEqual([]);
  });
  it("한 템플릿 3장만 남기면 그 템플릿 순번이 부족", () => {
    const cut = PLAN.filter(
      (c) => c.template !== "tpl-grid" || ["SV01", "SV02", "SV03"].includes(c.sv),
    );
    expect(stage1Issues(cut, TYPES)).toEqual([
      "INSUFFICIENT stage=1 template=tpl-grid seq=2",
      "INSUFFICIENT stage=1 template=tpl-grid seq=5",
      "INSUFFICIENT stage=1 template=tpl-grid seq=8",
    ]);
    expect(coverageIssues(cut, TYPES)).toContain("COVERAGE template=tpl-grid active=3");
  });
  it("altOk 5~160자", () => {
    expect(altOk("선택지 {n}: 히어로")).toBe(true);
    expect(altOk("짧음")).toBe(false);
    expect(altOk("가".repeat(161))).toBe(false);
  });
});
