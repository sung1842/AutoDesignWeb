// M3 수용 테스트(3/5): 취향 일치도 TM·S_free·노출 선택·QualityReport·임계값 원천
// (04장 4.10.4·4.10.7·4.12·4.19, AC-04-20·43·45, 09장 9.4.5 ⑥). API 계약은 ASSUMPTIONS ASM-079.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  QualityReportSchema,
  eligibility,
  qualityColumns,
  rankScore,
  selectVisible,
  tasteMatch,
  type CandidateScore,
} from "../../../packages/scoring/src/index.js";
import { getThresholds, thresholdNumber } from "../../../packages/config/src/index.js";
import { lockStage } from "../../../scripts/guard/stages/lock.js";
import { ROOT } from "../_support/sh.js";

const AX = ["A1", "A2", "A3", "A4", "A5"] as const;
type Ax = (typeof AX)[number];
const TAU = thresholdNumber("generation.taste.tau");
const LAMBDA = thresholdNumber("generation.taste.lambdaLayout");
const D0 = thresholdNumber("generation.taste.d0");
const SFREE_D0 = thresholdNumber("generation.sFreeD0");
const H_FLOOR = thresholdNumber("generation.harmonyFloor");
const TM_FLOOR = thresholdNumber("generation.tasteFloor");
const SF_FLOOR = thresholdNumber("generation.sFreeFloor");
const WARN_MAX = thresholdNumber("generation.lint.warnPerMockupMax");

const t5 = [0.4, 0.5, 0.6, 0.3, 0.2];
const sigma = [0.1, 0.1, 0.1, 0.1, 0.1];
const shift = (v: number[], dv: number[]): number[] => v.map((x, i) => x + dv[i]);
const allReliable: Record<Ax, boolean> = { A1: true, A2: true, A3: true, A4: true, A5: true };

describe("4.10.4 TM 공식(값은 config/thresholds.json generation.taste)", () => {
  it("모든 축 |v−t| = d → TM = 100·(1 − d/d0)", () => {
    for (const d of [0, D0 / 4, D0 / 2, D0]) {
      const r = tasteMatch({ v: shift(t5, [d, d, d, d, d]), t: t5, sigma, reliable: allReliable });
      expect(r.tm).toBeCloseTo(100 * Math.max(0, 1 - d / D0), 6);
    }
    const r = tasteMatch({
      v: shift(
        t5,
        [D0, D0, D0, D0, D0].map((x) => x * 2),
      ),
      t: t5,
      sigma,
      reliable: allReliable,
    });
    expect(r.tm).toBe(0);
  });

  it("가중 w_k ∝ m_k·λ_k/(σ_k²+τ²), Σw = 1, A1·A4는 λ = lambdaLayout", () => {
    const r = tasteMatch({ v: t5, t: t5, sigma, reliable: allReliable });
    const raw = AX.map(
      (a) => ((a === "A1" || a === "A4" ? LAMBDA : 1) * 1) / (0.1 ** 2 + TAU ** 2),
    );
    const sum = raw.reduce((s, x) => s + x, 0);
    AX.forEach((a, i) => expect(r.weights[a]).toBeCloseTo(raw[i] / sum, 9));
    expect(AX.reduce((s, a) => s + r.weights[a], 0)).toBeCloseTo(1, 9);
  });

  it("S_free = 100·clip(1 − rms_{A1,A4}(v−t)/sFreeD0)", () => {
    const dv = [0.06, 0.3, 0.3, 0.12, 0.3];
    const r = tasteMatch({ v: shift(t5, dv), t: t5, sigma, reliable: allReliable });
    const rms = Math.sqrt((dv[0] ** 2 + dv[3] ** 2) / 2);
    expect(r.sFree).not.toBeNull();
    expect(r.sFree ?? -1).toBeCloseTo(100 * Math.max(0, 1 - rms / SFREE_D0), 6);
  });
});

describe("AC-04-45 reliable 마스크·subjective·S_free null", () => {
  it("① A1·A4 unreliable → S_free null, SFREE_NA 1건, A1·A4 가중 0, 노출은 TM만으로", () => {
    const reliable = { ...allReliable, A1: false, A4: false };
    const big = 0.5; // A1·A4만 크게 어긋나도 TM에 영향 없음
    const r = tasteMatch({ v: shift(t5, [big, 0, 0, big, 0]), t: t5, sigma, reliable });
    expect(r.sFree).toBeNull();
    expect(r.warnings.filter((w) => w === "SFREE_NA").length).toBe(1);
    expect(r.weights.A1).toBe(0);
    expect(r.weights.A4).toBe(0);
    expect(r.tm).toBeCloseTo(100, 6);
    const e = eligibility({
      gatesPass: true,
      harmony: H_FLOOR,
      tm: r.tm,
      sFree: r.sFree,
      warn: 0,
      fallback: false,
    });
    expect(e).toBe(true);
    expect(
      eligibility({
        gatesPass: true,
        harmony: H_FLOOR,
        tm: TM_FLOOR - 1,
        sFree: null,
        warn: 0,
        fallback: false,
      }),
    ).toBe(false);
  });

  it("② A1 reliable·A4 unreliable → S_free는 A1 한 축", () => {
    const reliable = { ...allReliable, A4: false };
    const dv = [0.09, 0, 0, 0.5, 0];
    const r = tasteMatch({ v: shift(t5, dv), t: t5, sigma, reliable });
    expect(r.sFree ?? -1).toBeCloseTo(100 * Math.max(0, 1 - Math.abs(dv[0]) / SFREE_D0), 6);
    expect(r.warnings).not.toContain("SFREE_NA");
  });

  it("③ subjective 축의 정규화 전 가중 = 같은 조건 비주관 축의 절반", () => {
    const r = tasteMatch({
      v: t5,
      t: t5,
      sigma,
      reliable: allReliable,
      subjective: { A2: true },
    });
    expect(r.rawWeights.A2).toBeCloseTo(r.rawWeights.A3 / 2, 12);
    expect(r.rawWeights.A5).toBeCloseTo(r.rawWeights.A3, 12);
  });

  it("④ axis_gaps에 unreliable 축 0개", () => {
    const reliable = { ...allReliable, A1: false, A3: false };
    const r = tasteMatch({ v: shift(t5, [0.3, 0.3, 0.3, 0.3, 0.3]), t: t5, sigma, reliable });
    const keys = r.axisGaps.map((g) => g.axis);
    expect(keys).not.toContain("A1");
    expect(keys).not.toContain("A3");
    for (const k of keys) expect(reliable[k as Ax]).toBe(true);
  });
});

describe("4.12 eligible·rank·선택(9.4.5 ⑥ 경계값은 thresholds에서)", () => {
  const ok = {
    gatesPass: true,
    harmony: H_FLOOR,
    tm: TM_FLOOR,
    sFree: SF_FLOOR,
    warn: WARN_MAX,
    fallback: false,
  };
  it("경계값 포함 통과, 한 칸 아래 실패", () => {
    expect(eligibility(ok)).toBe(true);
    expect(eligibility({ ...ok, gatesPass: false })).toBe(false);
    expect(eligibility({ ...ok, harmony: H_FLOOR - 1 })).toBe(false);
    expect(eligibility({ ...ok, tm: TM_FLOOR - 0.01 })).toBe(false);
    expect(eligibility({ ...ok, sFree: SF_FLOOR - 0.01 })).toBe(false);
    expect(eligibility({ ...ok, warn: WARN_MAX + 1 })).toBe(false);
  });
  it("폴백: G 통과·H ≥ floor만 필수, TM·S_free 면제", () => {
    expect(eligibility({ ...ok, fallback: true, tm: 0, sFree: 0 })).toBe(true);
    expect(eligibility({ ...ok, fallback: true, harmony: H_FLOOR - 1 })).toBe(false);
    expect(eligibility({ ...ok, fallback: true, gatesPass: false })).toBe(false);
  });
  it("rank = 0.5625·TM + 0.4375·H", () => {
    expect(rankScore({ tm: 80, harmony: 90 })).toBeCloseTo(0.5625 * 80 + 0.4375 * 90, 9);
  });
  it("변형별 argmax rank, 동률은 패턴 슬롯 1 우선, 비eligible은 고르지 않음", () => {
    const c = (
      id: string,
      variant: string,
      slot: number,
      tm: number,
      harmony: number,
      el = true,
    ): CandidateScore => ({
      id,
      variant: variant as CandidateScore["variant"],
      patternSlot: slot,
      tm,
      harmony,
      eligible: el,
    });
    const pick = selectVisible([
      c("a", "v_true", 1, 80, 90),
      c("b", "v_true", 2, 90, 95, false),
      c("c", "v_fit", 2, 85, 85),
      c("d", "v_fit", 1, 85, 85),
      c("e", "v_bal", 1, 70, 70, false),
    ]);
    expect(pick.v_true).toBe("a");
    expect(pick.v_fit).toBe("d");
    expect(pick.v_bal).toBeNull();
  });
});

describe("AC-04-20 QualityReport ↔ candidates 컬럼", () => {
  const report = {
    candidate_id: "11111111-1111-4111-8111-111111111111",
    variant: "v_true",
    pattern_id: "PS-1",
    spec_id: "spec_x",
    compile_hash: "0".repeat(64),
    hard: Array.from({ length: 13 }, (_, i) => ({
      id: `G-${String(i + 1).padStart(2, "0")}`,
      status: "pass",
      measured: 0,
      limit: 0,
    })),
    harmony: 86,
    harmonyItems: Array.from({ length: 12 }, (_, i) => ({
      id: `H${i + 1}`,
      score: 1,
      measured: null,
    })),
    tasteMatch: 81.4,
    sFree: 70.2,
    taste: {
      v: [0.1, 0.2, 0.3, 0.4, 0.5],
      t: [0.1, 0.2, 0.3, 0.4, 0.5],
      d: 0.07,
      spec_drift: false,
    },
    clipped: false,
    lint: { error: [], warn: ["AIL-15"], hits: [] },
    judge: { mode: "log", j: null, raw: [] },
    originality: {
      config_version: "2027-S1.1",
      passed: true,
      violated: [],
      nearest_reference_id: null,
      g2_matches: 0,
      g2_matched_attrs: [],
      min_phash_distance: 64,
      min_phash_reference_id: null,
      g5_max_run: 0,
    },
    rank_score: null,
    round: 0,
    origin: "llm",
    auto_fixes: [],
    timings_ms: { compile: 1, render: 1, extract: 1, gates: 1, lint: 1, judge: 0 },
    visible: true,
    fallback: false,
    hide_reason: null,
    warnings: [],
  };
  it("스키마 유효, 컬럼 = 리포트에서 유도(반올림 smallint, eligible·rank 일치)", () => {
    const parsed = QualityReportSchema.parse(report);
    const col = qualityColumns(parsed);
    expect(col.harmony_score).toBe(Math.round(report.harmony));
    expect(col.taste_score).toBe(Math.round(report.tasteMatch));
    expect(col.eligible).toBe(true);
    expect(col.rank_score ?? -1).toBeCloseTo(
      rankScore({ tm: report.tasteMatch, harmony: report.harmony }),
      6,
    );
    expect(col.quality_report.rank_score ?? -1).toBeCloseTo(col.rank_score ?? -2, 6);
  });
  it("게이트 1개 fail → eligible false·visible 불가", () => {
    const bad = {
      ...report,
      hard: report.hard.map((g, i) =>
        i === 3 ? { ...g, status: "fail", code: "GATE_FAILED:G-04" } : g,
      ),
    };
    const col = qualityColumns(QualityReportSchema.parse(bad));
    expect(col.eligible).toBe(false);
    expect(() =>
      QualityReportSchema.parse({ ...bad, visible: true, fallback: false, eligibleOverride: true }),
    ).not.toThrow();
  });
  it("필수 필드 누락은 스키마 오류", () => {
    const { originality: _o, ...rest } = report;
    expect(QualityReportSchema.safeParse(rest).success).toBe(false);
    expect(QualityReportSchema.safeParse({ ...report, harmony: 101 }).success).toBe(false);
  });
});

/** 04장 4.19 AC-04-43 아래 문단의 키 경로(FINAL 원문). */
function specGenerationKeys(): string[] {
  const md = readFileSync(join(ROOT, "docs/spec/FINAL/04_generation.md"), "utf8");
  const i = md.indexOf("`config/thresholds.json`의 이 장 키는");
  const para = md.slice(i, md.indexOf("\n", i));
  const keys: string[] = [];
  for (const m of para.matchAll(/`([a-zA-Z0-9.]+?)(?:\.\{([a-zA-Z0-9, ]+)\})?`/g)) {
    const base = m[1].startsWith("generation.") ? m[1] : `generation.${m[1]}`;
    if (m[2]) for (const k of m[2].split(",")) keys.push(`${base}.${k.trim()}`);
    else keys.push(base);
  }
  return keys.map((k) => k.replace(/^generation\.perf\./, "perf."));
}

describe("AC-04-43 · 9.4.5 ⑥ 임계값 원천 = config/thresholds.json", () => {
  it("이 장의 generation.*·perf.* 키가 전부 존재(숫자)", () => {
    const keys = specGenerationKeys();
    expect(keys.length).toBeGreaterThanOrEqual(20);
    const th = getThresholds() as unknown as Record<string, unknown>;
    for (const k of keys) {
      const v = k
        .split(".")
        .reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], th);
      expect(typeof v, k).toBe("number");
    }
  });

  it("scoring 코드에 이 장 임계값 리터럴 비교 0건", () => {
    const vals = [H_FLOOR, TM_FLOOR, SF_FLOOR, TAU, LAMBDA, D0, SFREE_D0].map(String);
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) files.push(p);
      }
    };
    walk(join(ROOT, "packages/scoring/src"));
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, n) => {
          if (/^\s*(\/\/|\*)/.test(line)) return;
          for (const v of vals) {
            const re = new RegExp(`(<=|>=|<|>|/|\\*)\\s*${v.replace(".", "\\.")}(?![0-9])`);
            if (re.test(line)) hits.push(`${f}:${n + 1} ${v}`);
          }
        });
    }
    expect(hits).toEqual([]);
  });

  it("잠금 해시 검사 통과(guard 잠금 단계)", () => {
    const fails = lockStage().filter((f) => f.status === "fail");
    expect(fails.map((f) => `${f.fid} ${f.message}`)).toEqual([]);
  });
});
