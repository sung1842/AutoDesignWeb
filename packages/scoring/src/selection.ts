// 04장 4.10.4 취향 일치도 TM·S_free, 4.12 eligible·rank·노출 선택, 4.10.7 QualityReport(ASM-079).
// 상수 원천: config/thresholds.json generation.*(값은 코드에 쓰지 않는다, AC-04-43).
import { thresholdNumber } from "@tastefit/config";
import { z } from "zod";

export const AXES = ["A1", "A2", "A3", "A4", "A5"] as const;
export type Axis = (typeof AXES)[number];
export type Variant = "v_true" | "v_fit" | "v_bal";
const VARIANTS: readonly Variant[] = ["v_true", "v_fit", "v_bal"];

/** 4.10.4·4.11.2 구조 상수(임계값 아님): 레이아웃 영향 축, 주관 축 배율, axis_gaps 상위 수·최소 차, 점수 척도. */
export const TASTE_SPEC = {
  layoutAxes: ["A1", "A4"] as readonly Axis[],
  subjectiveFactor: 0.5,
  gapTop: 3,
  gapMin: 0.1,
  scale: 100,
} as const;
/** 4.12 [P0] 순위 가중(judge는 기록 전용, R-12). */
export const RANK_SPEC = { tm: 0.5625, harmony: 0.4375 } as const;

const clip01 = (x: number): number => Math.min(1, Math.max(0, x));
const th = (k: string): number => thresholdNumber(`generation.${k}`);

export interface TasteInput {
  v: number[];
  t: number[];
  sigma: number[];
  reliable: Record<Axis, boolean>;
  subjective?: Partial<Record<Axis, boolean>>;
}
export interface AxisGap {
  axis: Axis;
  target: number;
  actual: number;
  gap: number;
}
export interface TasteResult {
  tm: number;
  sFree: number | null;
  d: number;
  warnings: string[];
  weights: Record<Axis, number>;
  rawWeights: Record<Axis, number>;
  axisGaps: AxisGap[];
}

export function tasteMatch(input: TasteInput): TasteResult {
  const tau = th("taste.tau");
  const lambda = th("taste.lambdaLayout");
  const d0 = th("taste.d0");
  const sd0 = th("sFreeD0");
  const diff = (i: number): number => (input.v[i] ?? 0) - (input.t[i] ?? 0);
  const rawWeights = {} as Record<Axis, number>;
  AXES.forEach((a, i) => {
    const m =
      (input.reliable[a] ? 1 : 0) * (input.subjective?.[a] ? TASTE_SPEC.subjectiveFactor : 1);
    const l = TASTE_SPEC.layoutAxes.includes(a) ? lambda : 1;
    const s = input.sigma[i] ?? 0;
    rawWeights[a] = (m * l) / (s * s + tau * tau);
  });
  const sum = AXES.reduce((acc, a) => acc + rawWeights[a], 0);
  const weights = {} as Record<Axis, number>;
  for (const a of AXES) weights[a] = sum > 0 ? rawWeights[a] / sum : 0;
  const d = Math.sqrt(AXES.reduce((acc, a, i) => acc + weights[a] * diff(i) ** 2, 0));
  const tm = TASTE_SPEC.scale * clip01(1 - d / d0);
  const free = AXES.map((a, i) => ({ a, i })).filter(
    ({ a }) => TASTE_SPEC.layoutAxes.includes(a) && input.reliable[a],
  );
  const warnings: string[] = [];
  let sFree: number | null = null;
  if (free.length === 0) warnings.push("SFREE_NA");
  else {
    const rms = Math.sqrt(free.reduce((acc, { i }) => acc + diff(i) ** 2, 0) / free.length);
    sFree = TASTE_SPEC.scale * clip01(1 - rms / sd0);
  }
  const axisGaps = AXES.map((axis, i) => ({
    axis,
    target: input.t[i] ?? 0,
    actual: input.v[i] ?? 0,
    gap: Math.abs(diff(i)),
  }))
    .filter((g) => input.reliable[g.axis])
    .sort((x, y) => y.gap - x.gap)
    .slice(0, TASTE_SPEC.gapTop)
    .filter((g) => g.gap >= TASTE_SPEC.gapMin);
  return { tm, sFree, d, warnings, weights, rawWeights, axisGaps };
}

export interface EligibilityInput {
  gatesPass: boolean;
  harmony: number;
  tm: number;
  sFree: number | null;
  warn: number;
  fallback: boolean;
}
/** 4.12 eligible(경계 포함). 폴백은 G·H만 본다. */
export function eligibility(e: EligibilityInput): boolean {
  if (!e.gatesPass || e.harmony < th("harmonyFloor")) return false;
  if (e.fallback) return true;
  if (e.tm < th("tasteFloor")) return false;
  if (e.sFree !== null && e.sFree < th("sFreeFloor")) return false;
  return e.warn <= th("lint.warnPerMockupMax");
}
export function rankScore(s: { tm: number; harmony: number }): number {
  return RANK_SPEC.tm * s.tm + RANK_SPEC.harmony * s.harmony;
}

export interface CandidateScore {
  id: string;
  variant: Variant;
  patternSlot: number;
  tm: number;
  harmony: number;
  eligible: boolean;
}
/** 변형별 argmax rank(eligible만), 동률은 패턴 슬롯 1 우선. 없으면 null(→ 폴백). */
export function selectVisible(cands: readonly CandidateScore[]): Record<Variant, string | null> {
  const out = {} as Record<Variant, string | null>;
  for (const v of VARIANTS) {
    const pool = cands
      .filter((c) => c.variant === v && c.eligible)
      .sort((a, b) => rankScore(b) - rankScore(a) || a.patternSlot - b.patternSlot);
    out[v] = pool[0]?.id ?? null;
  }
  return out;
}

// ---------- 4.10.7 QualityReport ----------
const score100 = z.number().min(0).max(TASTE_SPEC.scale);
const vec5 = z.array(z.number()).length(AXES.length);
const gateId = z.string().regex(/^G-(0[1-9]|1[0-3])$/);
export const OriginalityReportSchema = z.object({
  config_version: z.string(),
  passed: z.boolean(),
  violated: z.array(z.enum(["G1", "G2", "G3", "G4", "G5", "G6"])),
  nearest_reference_id: z.string().nullable(),
  g2_matches: z.number().int().min(0),
  g2_matched_attrs: z.array(z.string()),
  min_phash_distance: z.number().min(0),
  min_phash_reference_id: z.string().nullable(),
  g5_max_run: z.number().int().min(0),
});
export const QualityReportSchema = z.object({
  candidate_id: z.string().min(1),
  variant: z.enum(["v_true", "v_fit", "v_bal"]),
  pattern_id: z.string().min(1),
  spec_id: z.string().min(1),
  compile_hash: z.string().min(1),
  hard: z
    .array(
      z.object({
        id: gateId,
        status: z.enum(["pass", "fail"]),
        measured: z.unknown(),
        limit: z.unknown(),
        viewport: z
          .union([
            z.literal(375),
            z.literal(768),
            z.literal(1024),
            z.literal(1280),
            z.literal(1920),
          ])
          .optional(),
        code: z
          .string()
          .regex(/^GATE_FAILED:G-\d{2}$/)
          .optional(),
      }),
    )
    .min(1),
  harmony: score100,
  harmonyItems: z.array(
    z.object({
      id: z.string().regex(/^H(1[0-2]|[1-9])$/),
      score: z.number(),
      measured: z.unknown(),
    }),
  ),
  tasteMatch: score100,
  sFree: score100.nullable(),
  taste: z.object({ v: vec5, t: vec5, d: z.number().min(0), spec_drift: z.boolean() }),
  clipped: z.boolean(),
  lint: z.object({
    error: z.array(z.string()),
    warn: z.array(z.string()),
    hits: z.array(z.unknown()),
  }),
  judge: z.object({
    mode: z.enum(["off", "log", "rank"]),
    j: z.number().nullable(),
    raw: z.array(z.unknown()),
  }),
  originality: OriginalityReportSchema,
  rank_score: z.number().nullable(),
  round: z.union([z.literal(0), z.literal(1)]),
  origin: z.enum(["llm", "repair", "fallback"]),
  auto_fixes: z.array(z.unknown()),
  timings_ms: z.object({
    compile: z.number(),
    render: z.number(),
    extract: z.number(),
    gates: z.number(),
    lint: z.number(),
    judge: z.number(),
  }),
  visible: z.boolean(),
  fallback: z.boolean(),
  hide_reason: z.string().nullable(),
  warnings: z.array(z.string()),
});
export type QualityReport = z.infer<typeof QualityReportSchema>;

/** candidates 컬럼 유도(06장 DDL: harmony_score·taste_score smallint, eligible, rank_score real). */
export function qualityColumns(r: QualityReport): {
  quality_report: QualityReport;
  harmony_score: number;
  taste_score: number;
  eligible: boolean;
  rank_score: number | null;
} {
  const eligible = eligibility({
    gatesPass: r.hard.every((g) => g.status === "pass"),
    harmony: r.harmony,
    tm: r.tasteMatch,
    sFree: r.sFree,
    warn: r.lint.warn.length,
    fallback: r.fallback,
  });
  const rank = eligible ? rankScore({ tm: r.tasteMatch, harmony: r.harmony }) : null;
  return {
    quality_report: { ...r, rank_score: rank },
    harmony_score: Math.round(r.harmony),
    taste_score: Math.round(r.tasteMatch),
    eligible,
    rank_score: rank,
  };
}
