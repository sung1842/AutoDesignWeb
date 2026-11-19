// 택소노미 로더(09장 9.4.3)와 유형 판정(02장 2.12.1)·브리지 배치 규칙(02장 2.4.2 규칙 1~3).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getThresholds, thresholdNumber } from "@tastefit/config";
import type { L1 } from "./map.js";

export interface TypeDef {
  id: string;
  slug: string;
  nameKo: string;
  centroid: L1;
  anchorPresetId: string;
}
export interface StandardVector {
  id: string; // SV01~SV16
  kind: "anchor" | "bridge";
  baseTypeId: string;
  l1: L1;
}
export interface CardPlanItem {
  id: string;
  svId: string;
  kind: "anchor" | "bridge";
  presetId: string;
  templateId: string;
  targetL1: L1;
}
export interface AbPlanItem {
  id: string;
  axis: string;
  basePresetId: string;
  levelA: number;
  levelB: number;
}
export interface Typing {
  tieEps: number;
  boundaryEps: number;
}
export interface Taxonomy {
  types: TypeDef[];
  standardVectors: StandardVector[];
  cardPlan: CardPlanItem[];
  abPlan: AbPlanItem[];
  typing: Typing;
}

function items<T>(root: string, rel: string): T[] {
  const j = JSON.parse(readFileSync(join(root, rel), "utf8")) as { items: T[] };
  return j.items;
}

/** data/taxonomy·data/survey를 읽는다. 판정 임계값은 config/thresholds.json(getThresholds)에서만. */
export function loadTaxonomy(root: string): Taxonomy {
  const types = items<TypeDef>(root, "data/taxonomy/types.json");
  const cardPlan = items<CardPlanItem>(root, "data/survey/card_plan.json");
  const abPlan = items<AbPlanItem>(root, "data/survey/ab_plan.json");
  const typeOfPreset = new Map(types.map((t) => [t.anchorPresetId, t.id]));
  const sv = new Map<string, StandardVector>();
  for (const c of cardPlan) {
    if (sv.has(c.svId)) continue;
    const baseTypeId = typeOfPreset.get(c.presetId);
    if (!baseTypeId) throw new Error(`${c.id}: 프리셋 ${c.presetId}의 유형 없음`);
    sv.set(c.svId, { id: c.svId, kind: c.kind, baseTypeId, l1: c.targetL1 });
  }
  const t = getThresholds(root);
  return {
    types,
    standardVectors: [...sv.values()].sort((a, b) => a.id.localeCompare(b.id)),
    cardPlan,
    abPlan,
    typing: {
      tieEps: thresholdNumber("diagnosis.typing.tieEps", t),
      boundaryEps: thresholdNumber("diagnosis.typing.boundaryEps", t),
    },
  };
}

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;
export const euclid = (a: readonly number[], b: readonly number[]): number =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0));
export const linf = (a: readonly number[], b: readonly number[]): number =>
  Math.max(...a.map((v, i) => Math.abs(v - (b[i] ?? 0))));

export interface TypeVerdict {
  first: string;
  second: string;
  margin: number;
  isTie: boolean;
  isBoundary: boolean;
}

/** 02장 2.12.1 nearestType. sigma(축별 사후 표준편차)가 있으면 동률 타이브레이크 ①에 쓴다. */
export function nearestType(
  tax: Taxonomy,
  mu: readonly number[],
  sigma?: readonly number[],
): TypeVerdict {
  const order = new Map(tax.types.map((t, i) => [t.id, i]));
  const prec = (c: readonly number[]): number =>
    sigma
      ? Math.sqrt(c.reduce((s, ck, k) => s + ((mu[k] ?? 0) - ck) ** 2 / (sigma[k] ?? 1) ** 2, 0))
      : 0;
  const ds = tax.types
    .map((t) => ({ id: t.id, d: round6(euclid(mu, t.centroid)), dp: prec(t.centroid) }))
    .sort((a, b) => a.d - b.d || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  let [m1, m2] = ds;
  if (!m1 || !m2) throw new Error("유형이 2개 미만");
  const margin = round6(m2.d - m1.d);
  const isTie = margin < tax.typing.tieEps;
  if (isTie && sigma && Math.abs(m1.dp - m2.dp) >= 1e-6 && m2.dp < m1.dp) [m1, m2] = [m2, m1];
  return {
    first: m1.id,
    second: m2.id,
    margin,
    isTie,
    isBoundary: margin < tax.typing.boundaryEps,
  };
}

export const classifyType = (tax: Taxonomy, v: readonly number[]): string =>
  nearestType(tax, v).first;

// 02장 2.4.2 브리지 배치 규칙 상수(이 장 소유 설계 규칙, 런타임 판정 임계값 아님)
const BRIDGE = {
  step: 0.05,
  lo: 0.15,
  hi: 0.85,
  linfMax: 0.45,
  pairMin: 0.45,
  corrMax: 0.3,
  binMin: 4,
};
const BINS = [0.33, 0.67];

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i] ?? 0) - mx;
    const dy = (y[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

/** 규칙 1~3 위반 목록(빈 배열 = 통과). 규칙 4는 survey:build(M4) 소관. */
export function checkBridgeRules(tax: Taxonomy): string[] {
  const out: string[] = [];
  const svs = tax.standardVectors;
  const centroid = new Map(tax.types.map((t) => [t.id, t.centroid]));
  for (const b of svs.filter((s) => s.kind === "bridge")) {
    for (const v of b.l1) {
      if (Math.abs(round6(v / BRIDGE.step) - Math.round(v / BRIDGE.step)) > 1e-6)
        out.push(`규칙1 ${b.id}: ${v}가 0.05 단위 아님`);
      if (v < BRIDGE.lo || v > BRIDGE.hi) out.push(`규칙1 ${b.id}: ${v} ∉ [0.15, 0.85]`);
    }
    const near = tax.types
      .map((t) => ({ id: t.id, d: round6(linf(b.l1, t.centroid)) }))
      .sort((x, y) => x.d - y.d)[0];
    if (!near || near.id !== b.baseTypeId)
      out.push(`규칙2 ${b.id}: 기준 유형 ${b.baseTypeId} ≠ L∞ 최근접 ${near?.id ?? "-"}`);
    if (near && near.d > BRIDGE.linfMax) out.push(`규칙2 ${b.id}: L∞ ${near.d} > 0.45`);
    if (!centroid.has(b.baseTypeId)) out.push(`규칙2 ${b.id}: 유형 ${b.baseTypeId} 없음`);
  }
  for (let i = 0; i < svs.length; i++)
    for (let j = i + 1; j < svs.length; j++) {
      const a = svs[i];
      const b = svs[j];
      if (a && b && round6(euclid(a.l1, b.l1)) < BRIDGE.pairMin)
        out.push(`규칙3 ${a.id}–${b.id}: 거리 < 0.45`);
    }
  const col = (k: number): number[] => svs.map((s) => s.l1[k] ?? 0);
  for (let a = 0; a < 5; a++) {
    for (let b = a + 1; b < 5; b++) {
      const r = pearson(col(a), col(b));
      if (Math.abs(r) > BRIDGE.corrMax)
        out.push(`규칙3 축 A${a + 1}–A${b + 1}: |r| ${r.toFixed(2)} > 0.30`);
    }
    const c = col(a);
    const counts = [
      c.filter((v) => v < (BINS[0] ?? 0)).length,
      c.filter((v) => v >= (BINS[0] ?? 0) && v < (BINS[1] ?? 0)).length,
      c.filter((v) => v >= (BINS[1] ?? 0)).length,
    ];
    if (counts.some((n) => n < BRIDGE.binMin))
      out.push(`규칙3 A${a + 1}: 3구간 ${counts.join("/")} 중 < 4`);
  }
  return out;
}
