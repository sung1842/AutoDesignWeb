// 02장 2.16.2 튜닝 절차(결정론, AC-02-36, ASM-091). 선택 함수는 dev 판정 결과(Check[])만 받는다.
// 평가기(dev)·gate는 주입한다: CLI는 실제 시뮬레이션, 메타 테스트는 픽스처.
import type { Check } from "./sim.js";
import type { Tuned } from "./model.js";

export interface Coordinate {
  id: string;
  /** Tuned에 적용(값 → 부분 구성). */
  apply: (t: Tuned, v: unknown) => Tuned;
  read: (t: Tuned) => unknown;
  values: unknown[];
  /** 이 좌표의 평가 지표 키(null = 전 지표). */
  metrics: string[] | null;
  /** ⑤: 사전 영향 행 + 전 지표 미달 수. */
  plusAllMisses?: boolean;
}
export interface TuningTrial {
  round: number;
  coordinate: string;
  value: unknown;
  devMetrics: { key: string; value: number; pass: boolean }[];
  objective: [number, number];
  chosen: boolean;
  gateRun: null | "PASS" | "FAIL";
  cached: boolean;
}
export interface TuningResult {
  final: Tuned;
  gateRuns: number;
  devTrials: number;
  passed: boolean;
  blocked: boolean;
  log: { trials: TuningTrial[] };
}

const keyOf = (t: Tuned): string => JSON.stringify(t, Object.keys(t).sort());

/** 2.16.2 좌표 ①~⑥(값 집합 원천 = thresholds diagnosis.tunable). */
export function coordinates(tunable: {
  typeDiscWeight: { values: number[] };
  llChanceRef: { values: [number, number][] };
  calibKappa: { values: number[] };
  candidateSamples: { values: number[] };
  priorWeight: { values: number[] };
  bridgeRelocated: { values: boolean[] };
}): Coordinate[] {
  return [
    {
      id: "typeDiscWeight",
      values: tunable.typeDiscWeight.values,
      read: (t) => t.typeDiscWeight,
      apply: (t, v) => ({ ...t, typeDiscWeight: v as number }),
      metrics: null,
    },
    {
      id: "llChanceRef",
      values: tunable.llChanceRef.values,
      read: (t) => [t.llChance, t.llRef],
      apply: (t, v) => ({
        ...t,
        llChance: (v as number[])[0] ?? t.llChance,
        llRef: (v as number[])[1] ?? t.llRef,
      }),
      metrics: ["consistencyBeta16Min", "consistencyBeta2Max"],
    },
    {
      id: "calibKappa",
      values: tunable.calibKappa.values,
      read: (t) => t.calibKappa,
      apply: (t, v) => ({ ...t, calibKappa: v as number }),
      metrics: ["coverage90"],
    },
    {
      id: "candidateSamples",
      values: tunable.candidateSamples.values,
      read: (t) => t.candidateSamples,
      apply: (t, v) => ({ ...t, candidateSamples: v as number }),
      metrics: null,
    },
    {
      id: "priorWeight",
      values: tunable.priorWeight.values,
      read: (t) => t.priorWeight,
      apply: (t, v) => ({ ...t, priorWeight: v as number }),
      metrics: ["priorTypeChangeMax"],
      plusAllMisses: true,
    },
    {
      id: "bridgeRelocated",
      values: tunable.bridgeRelocated.values,
      read: (t) => t.bridgeRelocated,
      apply: (t, v) => ({ ...t, bridgeRelocated: v as boolean }),
      metrics: null,
    },
  ];
}

/** 정규화 부족분(상한형 = (값 − 합격선)/합격선, 하한형 = (합격선 − 값)/합격선, 범위 = 구간까지 거리). */
function deficit(c: Check): number {
  if (c.pass) return 0;
  if (c.kind === "range") {
    const [lo, hi] = c.limit as [number, number];
    return c.value < lo ? lo - c.value : c.value - hi;
  }
  const lim = c.limit as number;
  const den = Math.abs(lim) > 0 ? Math.abs(lim) : 1;
  return c.kind === "max" ? (c.value - lim) / den : (lim - c.value) / den;
}
/** 사전식 목적함수 ①②: [미달 수, 부족분 합](작을수록 좋다). */
export function objective(
  checks: Check[],
  keys: string[] | null,
  plusAllMisses = false,
): [number, number] {
  const sel = keys ? checks.filter((c) => keys.includes(c.key)) : checks;
  const misses =
    sel.filter((c) => !c.pass).length + (plusAllMisses ? checks.filter((c) => !c.pass).length : 0);
  return [misses, sel.reduce((s, c) => s + deficit(c), 0)];
}
const better = (a: [number, number], b: [number, number]): boolean =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/**
 * 좌표 순차 탐색. 한 바퀴(①~⑥, 시작점 포함)가 끝날 때마다 또는 dev 시도가 maxTrials에 닿으면 gate 1회.
 * gate는 PASS/FAIL만 돌려주고 선택에 쓰이지 않는다. gate 실행 수 ≤ maxGateRuns. 같은 구성 dev 결과는 캐시(cached=true, 세지 않음).
 */
export function tune(input: {
  start: Tuned;
  coordinates: Coordinate[];
  dev: (t: Tuned) => Check[];
  gate: (t: Tuned) => boolean;
  maxTrials: number;
  maxGateRuns: number;
}): TuningResult {
  const cache = new Map<string, Check[]>();
  const trials: TuningTrial[] = [];
  let devTrials = 0;
  let gateRuns = 0;
  let cur = input.start;
  let passed = false;
  const evalDev = (t: Tuned): { checks: Check[]; cached: boolean } => {
    const k = keyOf(t);
    const hit = cache.get(k);
    if (hit) return { checks: hit, cached: true };
    devTrials++;
    const checks = input.dev(t);
    cache.set(k, checks);
    return { checks, cached: false };
  };
  const summary = (cs: Check[]): TuningTrial["devMetrics"] =>
    cs.map((c) => ({ key: c.key, value: c.value, pass: c.pass }));
  for (let round = 1; gateRuns < input.maxGateRuns && !passed; round++) {
    let capped = false;
    const base = evalDev(cur);
    trials.push({
      round,
      coordinate: "start",
      value: null,
      devMetrics: summary(base.checks),
      objective: objective(base.checks, null),
      chosen: true,
      gateRun: null,
      cached: base.cached,
    });
    for (const co of input.coordinates) {
      if (capped) break;
      const curChecks = evalDev(cur).checks;
      let bestV = co.read(cur);
      let bestObj = objective(curChecks, co.metrics, co.plusAllMisses);
      const curFails = new Set(curChecks.filter((c) => !c.pass).map((c) => c.key));
      for (const v of co.values) {
        if (JSON.stringify(v) === JSON.stringify(co.read(cur))) continue;
        if (devTrials >= input.maxTrials) {
          capped = true;
          break;
        }
        const cand = co.apply(cur, v);
        const r = evalDev(cand);
        const obj = objective(r.checks, co.metrics, co.plusAllMisses);
        const newFail = r.checks.some((c) => !c.pass && !curFails.has(c.key));
        const take = !newFail && better(obj, bestObj);
        trials.push({
          round,
          coordinate: co.id,
          value: v,
          devMetrics: summary(r.checks),
          objective: obj,
          chosen: false,
          gateRun: null,
          cached: r.cached,
        });
        if (take) {
          bestObj = obj;
          bestV = v;
        }
      }
      // 같으면 현재 값 유지(③) — better가 엄격 비교라 자동으로 유지된다
      const chosen = co.apply(cur, bestV);
      for (const t of trials)
        if (t.round === round && t.coordinate === co.id)
          t.chosen = JSON.stringify(t.value) === JSON.stringify(bestV);
      cur = chosen;
    }
    gateRuns++;
    passed = input.gate(cur);
    trials.push({
      round,
      coordinate: "gate",
      value: null,
      devMetrics: [],
      objective: [0, 0],
      chosen: true,
      gateRun: passed ? "PASS" : "FAIL",
      cached: false,
    });
    if (devTrials >= input.maxTrials && !passed) break;
  }
  return { final: cur, gateRuns, devTrials, passed, blocked: !passed, log: { trials } };
}
