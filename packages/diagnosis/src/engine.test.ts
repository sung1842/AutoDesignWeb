// 02장 AC-02-24(nextQuestion+applyAnswer p95 ≤ 20ms) 사양 상수 대조(BLK-014 유형, ASM-090 ⑤). AC-02-06은 BLK-020.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findRepoRoot } from "@tastefit/config";
import { createEngine, type EngineItems } from "./index.js";

/** 02장 2.17 사양 상수. */
const SPEC = { stepP95Ms: 20 } as const;
const ROOT = findRepoRoot();
const json = <T>(rel: string): T => JSON.parse(readFileSync(`${ROOT}/${rel}`, "utf8")) as T;

describe("진단 엔진 사양 상수", () => {
  it("AC-02-24 next+answer p95 ≤ 20ms", () => {
    const cards = json<{
      items: { id: string; svId: string; templateId: string; targetL1: number[] }[];
    }>("data/survey/card_plan.json").items;
    const ab = json<{
      items: {
        id: string;
        axis: string;
        basePresetId: string;
        levelA: number;
        levelB: number;
        images: { id: string; targetL1: number[] }[];
      }[];
    }>("data/survey/ab_plan.json").items;
    const types = json<{ items: { id: string; centroid: number[] }[] }>(
      "data/taxonomy/types.json",
    ).items;
    const items: EngineItems = {
      cards: cards.map((c) => ({ id: c.id, sv: c.svId, template: c.templateId, x: c.targetL1 })),
      pairs: ab.map((p) => ({
        id: p.id,
        axis: p.axis,
        typeId: p.basePresetId.replace(/^PS-/, ""),
        levels: [p.levelA, p.levelB],
        a: { id: p.images[0]?.id ?? "", x: p.images[0]?.targetL1 ?? [] },
        b: { id: p.images[1]?.id ?? "", x: p.images[1]?.targetL1 ?? [] },
      })),
    };
    const ms: number[] = [];
    for (let s = 0; s < 30; s++) {
      const e = createEngine({ items, types, seed: `bench-${s}`, purpose: null });
      for (;;) {
        const t0 = performance.now();
        const q = e.next();
        if (!q) break;
        e.answer({
          seq: q.seq,
          kind: "option",
          chosen: q.options[0]?.itemId ?? "",
          latencyMs: 2000,
        });
        ms.push(performance.now() - t0);
      }
    }
    ms.sort((a, b) => a - b);
    expect(ms[Math.ceil(0.95 * ms.length) - 1] ?? Infinity).toBeLessThanOrEqual(SPEC.stepP95Ms);
  });
});
