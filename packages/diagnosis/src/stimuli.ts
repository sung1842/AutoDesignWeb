// 설문 자극물 판정(02장 2.4.2·2.4.4·2.4.6·2.6.1, 05장 5.9). survey:build·--check가 쓰는 순수 함수(ASM-093).
import { diagConst, nearestType, type TypeCenter, type Vec } from "./model.js";

/** 05장 5.9 표 행 "설문 카드"·"A/B 쌍", 02장 2.4.2 커버리지, 2.3.6 대체 텍스트 길이(BLK-021: thresholds 밖 사양 값). */
export const STIMULI_SPEC = {
  /** 카드×축 이 비율 이상이 cardTol 이내(그리고 모든 카드×축 ≤ diagnosis.surveyAssetL1AbsMax). */
  cardWithinRatio: 0.95,
  cardTol: 0.1,
  /** A/B 대상 축 |Δ̂| ≥ 이 배수 × |Δ의도|, 비대상 축 |Δ̂| ≤ pairOffAxisMax. */
  pairOnAxisRatio: 0.5,
  pairOffAxisMax: 0.08,
  /** 커버리지: 템플릿별 active SV ≥ 14, 축별 3구간 각각 ≥ 25%, 유형별 카드 ≥ 3. */
  coverageActivePerTemplate: 14,
  coverageBinMinRatio: 0.25,
  coverageBins: [0.33, 0.67],
  coveragePerType: 3,
  altMin: 5,
  altMax: 160,
  /** 축별 활성 쌍 하한(09장 M4 ①, S-06 g). */
  pairsPerAxisMin: 19,
} as const;

export const TEMPLATE_ORDER = ["tpl-hero", "tpl-grid", "tpl-text"] as const;
export const AXIS_IDS = ["A1", "A2", "A3", "A4", "A5"] as const;
const CARDS_PER_QUESTION = 4;

const absMax = (): number => diagConst().surveyAssetL1AbsMax;

export interface CardJudge {
  ok: boolean;
  maxErr: number;
  /** cardTol 이내인 축 수. */
  within: number;
  reasons: string[];
}
/** 카드 한 장 판정: 모든 축 |x − target| ≤ surveyAssetL1AbsMax. 풀 비율은 cardPoolOk. */
export function judgeCard(target: Vec, x: Vec, cap: number = absMax()): CardJudge {
  const errs = target.map((t, k) => Math.abs((x[k] ?? NaN) - t));
  const maxErr = Math.max(...errs);
  const reasons = errs.flatMap((e, k) =>
    e > cap ? [`${AXIS_IDS[k]} |Δ|=${e.toFixed(3)} > ${cap}`] : [],
  );
  return {
    ok: reasons.length === 0 && Number.isFinite(maxErr),
    maxErr,
    within: errs.filter((e) => e <= STIMULI_SPEC.cardTol).length,
    reasons,
  };
}
/** 활성 후보 카드 풀의 카드×축 cardTol 이내 비율 ≥ cardWithinRatio. */
export function cardPoolOk(js: readonly CardJudge[]): { ok: boolean; ratio: number } {
  const total = js.length * AXIS_IDS.length;
  const ratio = total === 0 ? 1 : js.reduce((s, j) => s + j.within, 0) / total;
  return { ok: ratio >= STIMULI_SPEC.cardWithinRatio, ratio };
}

/** A/B 쌍 판정(5.9): 대상 축 부호 일치 & |Δ̂| ≥ 0.5|Δ|, 비대상 축 |Δ̂| ≤ 0.08. */
export function judgePair(
  axis: string,
  levels: readonly [number, number],
  xa: Vec,
  xb: Vec,
): { ok: boolean; reasons: string[] } {
  const k = AXIS_IDS.indexOf(axis as (typeof AXIS_IDS)[number]);
  if (k < 0) return { ok: false, reasons: [`알 수 없는 축 ${axis}`] };
  const want = levels[1] - levels[0];
  const reasons: string[] = [];
  const got = (xb[k] ?? NaN) - (xa[k] ?? NaN);
  if (!(
    Math.sign(got) === Math.sign(want) &&
    Math.abs(got) >= STIMULI_SPEC.pairOnAxisRatio * Math.abs(want)
  ))
    reasons.push(`${axis} Δ̂=${got.toFixed(3)} (의도 ${want.toFixed(2)})`);
  AXIS_IDS.forEach((a, j) => {
    if (j === k) return;
    const d = Math.abs((xb[j] ?? NaN) - (xa[j] ?? NaN));
    if (!(d <= STIMULI_SPEC.pairOffAxisMax)) reasons.push(`비대상 ${a} |Δ̂|=${d.toFixed(3)}`);
  });
  return { ok: reasons.length === 0, reasons };
}

export interface CheckCard {
  id: string;
  sv: string;
  template: string;
  x: Vec;
  mobile?: boolean;
}

/** 02장 2.4.2 커버리지(활성 카드 기준). 문제 줄 목록(비면 통과). */
export function coverageIssues(
  active: readonly CheckCard[],
  types: readonly TypeCenter[],
): string[] {
  const out: string[] = [];
  for (const t of TEMPLATE_ORDER) {
    const n = new Set(active.filter((c) => c.template === t).map((c) => c.sv)).size;
    if (n < STIMULI_SPEC.coverageActivePerTemplate) out.push(`COVERAGE template=${t} active=${n}`);
  }
  const [lo, hi] = STIMULI_SPEC.coverageBins;
  AXIS_IDS.forEach((a, k) => {
    const bins = [0, 0, 0];
    for (const c of active) {
      const v = c.x[k] ?? NaN;
      bins[v < lo ? 0 : v < hi ? 1 : 2]! += 1;
    }
    bins.forEach((b, i) => {
      if (active.length === 0 || b / active.length < STIMULI_SPEC.coverageBinMinRatio)
        out.push(`COVERAGE axis=${a} bin=${i} count=${b}/${active.length}`);
    });
  });
  const sig0 = AXIS_IDS.map(() => diagConst().sigma0);
  const per = new Map(types.map((t) => [t.id, 0]));
  for (const c of active) {
    const id = nearestType(c.x, sig0, types).typeId;
    per.set(id, (per.get(id) ?? 0) + 1);
  }
  for (const [id, n] of per)
    if (n < STIMULI_SPEC.coveragePerType) out.push(`COVERAGE type=${id} cards=${n}`);
  return out;
}

const dist = (a: Vec, b: Vec): number =>
  Math.sqrt(a.reduce((s, v, k) => s + (v - (b[k] ?? 0)) ** 2, 0));

/** 2.6.1 해제 불가 제약 (a)(b)(f)를 만족하는 4장 조합이 있는가(전수). */
function feasible(pool: readonly CheckCard[], types: readonly TypeCenter[]): boolean {
  const D = diagConst();
  const sig0 = AXIS_IDS.map(() => D.sigma0);
  const ty = pool.map((c) => nearestType(c.x, sig0, types).typeId);
  const n = pool.length;
  const ok = (idx: number[]): boolean => {
    for (let i = 0; i < idx.length; i++)
      for (let j = i + 1; j < idx.length; j++)
        if (dist(pool[idx[i]!]!.x, pool[idx[j]!]!.x) < D.stage1.minPairDist) return false;
    return true;
  };
  const rec = (start: number, pick: number[]): boolean => {
    if (!ok(pick)) return false;
    if (pick.length === CARDS_PER_QUESTION)
      return new Set(pick.map((i) => ty[i])).size >= D.stage1.minDistinctTypes;
    for (let i = start; i < n; i++) if (rec(i + 1, [...pick, i])) return true;
    return false;
  };
  return rec(0, []);
}

/** 1단계 (템플릿, 문항 순번)마다 후보 ≥ 1인지(데스크톱·모바일 각각). 부족한 곳 줄 목록. */
export function stage1Issues(active: readonly CheckCard[], types: readonly TypeCenter[]): string[] {
  const D = diagConst();
  const bad = new Map<string, boolean>();
  for (const t of TEMPLATE_ORDER) {
    const pool = active.filter((c) => c.template === t);
    const mob = pool.filter((c) => c.mobile !== false);
    bad.set(t, !feasible(pool, types) || !feasible(mob, types));
  }
  const out: string[] = [];
  for (let seq = 1; seq <= D.stage1Questions; seq++) {
    const t = TEMPLATE_ORDER[(seq - 1) % TEMPLATE_ORDER.length]!;
    if (bad.get(t)) out.push(`INSUFFICIENT stage=1 template=${t} seq=${seq}`);
  }
  return out;
}

/** 대체 텍스트 길이(2.3.6). */
export const altOk = (s: string): boolean =>
  [...s].length >= STIMULI_SPEC.altMin && [...s].length <= STIMULI_SPEC.altMax;
