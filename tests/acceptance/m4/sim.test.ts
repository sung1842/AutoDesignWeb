// M4 수용 테스트(2/7): sim:survey 게이트·합성 금지·튜닝 절차(02장 2.16, AC-02-22·35·36, AC-07-08, 09장 9.4.6 ④).
// API 계약은 ASSUMPTIONS ASM-091.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONDITIONS,
  NON_BLOCKING,
  judge,
  pooled,
  simulate,
  tune,
  type Check,
  type Coordinate,
  type EngineItems,
  type SimMetrics,
  type Tuned,
} from "../../../packages/diagnosis/src/index.js";
import { getThresholds } from "../../../packages/config/src/index.js";
import { ROOT, run } from "../_support/sh.js";

type Vec = number[];
const SS = (
  getThresholds().release as unknown as {
    surveySim: {
      seeds: { gate: number[]; dev: number[] };
      populationPerSeed: number;
      populationPA: number;
      maxTuningTrials: number;
      maxGateRuns: number;
    };
  }
).surveySim;
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
const TYPES = read<{ items: { id: string; centroid: Vec }[] }>("data/taxonomy/types.json").items;
const TUNED = read<Tuned>("config/diagnosis-tuned.json");

/** survey:build 산출 x_card(active만). 없으면 null. */
function xCardItems(): EngineItems | null {
  const p = join(ROOT, "data/survey/manifest.lock.json");
  if (!existsSync(p)) return null;
  const man = new Map(
    read<{ items: { assetId: string; x: Vec; status: string }[] }>(
      "data/survey/manifest.lock.json",
    ).items.map((x) => [x.assetId, x]),
  );
  const cards = read<{ items: { id: string; svId: string; templateId: string }[] }>(
    "data/survey/card_plan.json",
  ).items;
  const ab = read<{
    items: {
      id: string;
      axis: string;
      basePresetId: string;
      levelA: number;
      levelB: number;
      images: { id: string }[];
    }[];
  }>("data/survey/ab_plan.json").items;
  const act = (id: string): boolean => man.get(id)?.status === "active";
  return {
    cards: cards
      .filter((c) => act(c.id))
      .map((c) => ({
        id: c.id,
        sv: c.svId,
        template: c.templateId,
        x: man.get(c.id)!.x,
        mobile: true,
      })),
    pairs: ab
      .filter((p) => p.images.every((i) => act(i.id)))
      .map((p) => ({
        id: p.id,
        axis: p.axis,
        typeId: p.basePresetId.replace(/^PS-/, ""),
        levels: [p.levelA, p.levelB] as [number, number],
        a: { id: p.images[0]!.id, x: man.get(p.images[0]!.id)!.x },
        b: { id: p.images[1]!.id, x: man.get(p.images[1]!.id)!.x },
      })),
  };
}

describe("AC-02-35 gate는 x_card만, 합성은 판정 없음", () => {
  it("--synthetic --gate 종료 코드 1", async () => {
    const r = await run("pnpm", ["-s", "sim:survey", "--synthetic", "--gate"], ROOT);
    expect(r.code).toBe(1);
  });
  it("조건 목록에 V-MEAS·V-LAMBDA·V-POS·V-MIX가 있고 비차단", () => {
    for (const v of ["V-MEAS", "V-LAMBDA", "V-POS", "V-MIX"] as const) {
      expect(
        CONDITIONS.some((c) => c.variant === v),
        v,
      ).toBe(true);
      expect(NON_BLOCKING).toContain(v);
    }
  });
  it("x_card를 한 축 +0.1 옮기면 RMSE가 바뀐다", () => {
    const base = xCardItems();
    expect(base, "data/survey/manifest.lock.json(survey:build 산출) 없음").not.toBeNull();
    if (!base) return;
    const shift = (x: Vec): Vec => x.map((v, i) => (i === 0 ? Math.min(1, v + 0.1) : v));
    const moved: EngineItems = {
      cards: base.cards.map((c) => ({ ...c, x: shift(c.x) })),
      pairs: base.pairs.map((p) => ({
        ...p,
        a: { ...p.a, x: shift(p.a.x) },
        b: { ...p.b, x: shift(p.b.x) },
      })),
    };
    const cond = CONDITIONS.find((c) => c.id === "PU-b8")!;
    const seed = SS.seeds.gate[0]!;
    const n = SS.populationPerSeed;
    const a = simulate({ items: base, types: TYPES, condition: cond, n, seed, tuned: TUNED });
    const b = simulate({ items: moved, types: TYPES, condition: cond, n, seed, tuned: TUNED });
    expect(b.rmse).not.toBe(a.rmse);
  });
});

describe("9.4.6 ④ · AC-02-22 gate 시드 풀링 판정(x_card)", () => {
  const perSeed: Record<string, SimMetrics[]> = {};
  // 시드마다 별도 it(러너 타임아웃 1곳 규칙, ASM-004)
  for (const seed of SS.seeds.gate)
    it(`gate 시드 ${seed}`, () => {
      const items = xCardItems();
      expect(items, "x_card 없음(survey:build 먼저)").not.toBeNull();
      if (!items) return;
      for (const c of CONDITIONS) {
        const n = c.population === "P-A" ? SS.populationPA : SS.populationPerSeed;
        (perSeed[c.id] ??= []).push(
          simulate({ items, types: TYPES, condition: c, n, seed, tuned: TUNED }),
        );
      }
    });
  it("모든 차단 합격선 통과(점추정), 문항 수 상한·1단계 정확히", () => {
    const results = Object.fromEntries(Object.entries(perSeed).map(([k, v]) => [k, pooled(v)]));
    expect(Object.keys(results).length).toBe(CONDITIONS.length);
    const fails = judge(results)
      .filter((c) => !c.pass)
      .map((c) => `${c.key} ${c.value.toFixed(4)} vs ${JSON.stringify(c.limit)}`);
    expect(fails).toEqual([]);
  });
});

// ---------- AC-02-36 튜닝 절차(픽스처 평가기) ----------
const T0: Tuned = {
  typeDiscWeight: 5,
  llChance: -0.15,
  llRef: 0.25,
  calibKappa: 1.3,
  candidateSamples: 200,
  priorWeight: 0.3,
  bridgeRelocated: false,
};
const tunable = (
  getThresholds().diagnosis as unknown as {
    tunable: Record<string, { values: unknown[] }>;
  }
).tunable;
function coords(): Coordinate[] {
  const set =
    <K extends keyof Tuned>(k: K) =>
    (t: Tuned, v: unknown): Tuned => ({ ...t, [k]: v });
  return [
    {
      id: "typeDiscWeight",
      values: tunable.typeDiscWeight!.values,
      read: (t) => t.typeDiscWeight,
      apply: set("typeDiscWeight"),
      metrics: null,
    },
    {
      id: "llChanceRef",
      values: tunable.llChanceRef!.values,
      read: (t) => [t.llChance, t.llRef],
      apply: (t, v) => ({ ...t, llChance: (v as number[])[0]!, llRef: (v as number[])[1]! }),
      metrics: ["k"],
    },
    {
      id: "calibKappa",
      values: tunable.calibKappa!.values,
      read: (t) => t.calibKappa,
      apply: set("calibKappa"),
      metrics: ["c"],
    },
    {
      id: "candidateSamples",
      values: tunable.candidateSamples!.values,
      read: (t) => t.candidateSamples,
      apply: set("candidateSamples"),
      metrics: null,
    },
    {
      id: "priorWeight",
      values: tunable.priorWeight!.values,
      read: (t) => t.priorWeight,
      apply: set("priorWeight"),
      metrics: ["p"],
      plusAllMisses: true,
    },
    {
      id: "bridgeRelocated",
      values: tunable.bridgeRelocated!.values,
      read: (t) => t.bridgeRelocated,
      apply: set("bridgeRelocated"),
      metrics: null,
    },
  ];
}
const check = (key: string, value: number, limit: number): Check => ({
  key,
  value,
  limit,
  kind: "min",
  pass: value >= limit,
});
/** 모든 구성이 같은 dev 결과(동률) — 목적함수로 현재 값 유지. */
const flatDev = (): Check[] => [check("k", 0.4, 0.5), check("c", 0.9, 0.85), check("p", 0.9, 0.9)];
/** typeDiscWeight가 클수록·bridgeRelocated=true면 좋아지는 dev(1바퀴에서 첫·마지막 좌표가 바뀌어 2바퀴 조합이 새로 생김). 합격 불가. */
const slopeDev = (t: Tuned): Check[] => [
  check("all", t.typeDiscWeight + (t.bridgeRelocated ? 10 : 0), 99),
  check("k", 0.4, 0.5),
];

describe("AC-02-36 튜닝 절차", () => {
  const base = {
    coordinates: coords(),
    maxTrials: SS.maxTuningTrials,
    maxGateRuns: SS.maxGateRuns,
  };
  it("③④ dev 동률 + gate 항상 FAIL → gate maxGateRuns회, dev(cached=false) 1바퀴분, 상한 도달", () => {
    const r = tune({ ...base, start: T0, dev: flatDev, gate: () => false });
    expect(r.gateRuns).toBe(SS.maxGateRuns);
    const fresh = r.log.trials.filter((t) => t.coordinate !== "gate" && !t.cached);
    const oneRound = 1 + coords().reduce((s, c) => s + c.values.length - 1, 0);
    expect(fresh.length).toBe(oneRound);
    expect(r.devTrials).toBe(oneRound);
    expect(r.log.trials.filter((t) => t.round === 1 && t.coordinate !== "gate").length).toBe(
      oneRound,
    );
    expect(r.blocked).toBe(true);
  });
  it("① 같은 입력 2회 → tuning-log 바이트 동일", () => {
    const a = tune({ ...base, start: T0, dev: slopeDev, gate: () => false });
    const b = tune({ ...base, start: T0, dev: slopeDev, gate: () => false });
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));
  });
  it("⑥⑦ 1바퀴 gate FAIL 뒤 2바퀴에서 dev 상한 → gate 2회, dev ≤ maxTrials, 2바퀴 시작점 cached, 최종 = 마지막 gate 구성", () => {
    const gated: Tuned[] = [];
    const run1 = tune({ ...base, start: T0, dev: slopeDev, gate: (t) => (gated.push(t), false) });
    expect(run1.gateRuns).toBe(2);
    expect(run1.devTrials).toBeLessThanOrEqual(SS.maxTuningTrials);
    expect(run1.log.trials.some((t) => t.round === 2 && t.coordinate === "start" && t.cached)).toBe(
      true,
    );
    expect(run1.final).toEqual(gated.at(-1));
    const run2 = tune({ ...base, start: T0, dev: slopeDev, gate: () => false });
    expect(JSON.stringify(run2.log)).toBe(JSON.stringify(run1.log));
  });
  it("② 선택 함수는 gate 결과를 받지 않는다(정적: gate 호출 결과는 passed에만)", () => {
    const src = readFileSync(join(ROOT, "packages/diagnosis/src/tune.ts"), "utf8");
    const calls = [...src.matchAll(/input\.gate\(/g)];
    expect(calls.length).toBe(1);
    expect(/passed = input\.gate\(cur\)/.test(src)).toBe(true);
  });
});

describe("AC-07-08 sim 리포트 산출", () => {
  it("--synthetic dev 스모크(--n 100) 실행 → sim/reports/synthetic-latest.{json,md}, stimulus.source·verdict n/a", async () => {
    const r = await run(
      "pnpm",
      ["-s", "sim:survey", "--synthetic", "--n", "100", "--out", "reports/sim-acc"],
      ROOT,
    );
    expect(r.code, r.out.slice(-400)).toBe(0);
    const rep = read<{
      stimulus: { source: string };
      verdict: string;
      conditions: unknown[];
      checks: unknown[];
    }>("reports/sim-acc/synthetic-latest.json");
    expect(rep.stimulus.source).toBe("synthetic");
    expect(rep.verdict).toBe("n/a");
    expect(rep.conditions).toHaveLength(CONDITIONS.length);
    expect(existsSync(join(ROOT, "reports/sim-acc/synthetic-latest.md"))).toBe(true);
  });
});
