// M5 수용 테스트(9): 골든 세트 Mock 실행(32케이스 × 3회, R-11) 위의 잡 집계 AC.
// AC-01-30·32, AC-04-16·24, AC-08-25. 케이스 취향은 페르소나 계획 L1(thetaStar)·기대 유형을 프로젝트 taste_snapshot에 주입한다
// (골든 답안은 BLK-022로 아직 없다 — M4 build-answers의 "계획 L1 픽스처"와 같은 방식). 계약: ASSUMPTIONS ASM-116.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { openPipe, type Pipe, type Row } from "../_support/pipe.js";
import { ROOT } from "../_support/sh.js";

interface GoldenCase {
  id: string;
  purpose: string;
  persona: { thetaStar: Record<string, number> };
  brand: Record<string, unknown> & { name: string };
  expected: { typeId: string };
}
const CASES: GoldenCase[] = readdirSync(join(ROOT, "data/golden"))
  .filter((f) => /^GS-\d+\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(ROOT, "data/golden", f), "utf8")) as GoldenCase);
const RUNS = thresholdNumber("release.golden.runsPerCase");
const N_CASES = thresholdNumber("release.golden.cases");
const FULL_MIN = thresholdNumber("release.golden.fullSuccessMin");
const GUARANTEE_MIN = thresholdNumber("release.golden.minGuarantee");
const PAIR_D_MIN = thresholdNumber("generation.variant.candidatePairDistMin");
const FIRST_P50 = thresholdNumber("perf.firstExposeP50Sec");
const ALL_P50 = thresholdNumber("perf.latencyP50Sec");
const ALL_P95 = thresholdNumber("perf.latencyP95Sec");
const KILL_S = thresholdNumber("generation.killAtSec");
/** AC-01-30 표본 크기(생성 20회). */
const LATENCY_SAMPLE = 20;

let P: Pipe;
type Run = { case: GoldenCase; jobId: string; row: Row; mockups: Row[]; cands: Row[] };
const runs: Run[] = [];
const num = (v: unknown) => Number(v ?? 0);
const ms = (v: unknown) => new Date(String(v)).getTime();
const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] ?? Number.NaN;
};

beforeAll(async () => {
  P = await openPipe("tastefit_m5golden");
});
afterAll(async () => {
  await P?.close();
});

describe("골든 세트 실행(32 × 3, Mock)", () => {
  it("골든 케이스 수 = release.golden.cases", () => {
    expect(CASES).toHaveLength(N_CASES);
  });
  for (const c of CASES)
    it(`골든 ${c.id} × runsPerCase 실행`, async () => {
      for (let r = 0; r < RUNS; r++) {
        const j = await P.job("ok", {
          purpose: c.purpose,
          brand: c.brand,
          beforeGenerate: async (projectId) => {
            await P.rows(
              `update projects set taste_snapshot = jsonb_set(jsonb_set(taste_snapshot, '{mu}', $2::jsonb), '{type_id}', to_jsonb($3::text))
               where id = $1`,
              [projectId, JSON.stringify(c.persona.thetaStar), c.expected.typeId],
            );
          },
        });
        runs.push({
          case: c,
          jobId: j.jobId,
          row: j.row,
          mockups: await P.mockups(j.jobId),
          cands: await P.rows(
            "select id, slot, eligible, quality_report from candidates where job_id = $1 and origin <> 'fallback' order by slot, created_at",
            [j.jobId],
          ),
        });
      }
    });
});

describe("골든 집계", () => {
  it("AC-04-24 succeeded 비율 ≥ fullSuccessMin, 시안 ≥ 1개 보장률 ≥ minGuarantee(32 × 3)", () => {
    expect(runs).toHaveLength(N_CASES * RUNS);
    const ok = runs.filter((r) => r.row.status === "succeeded").length / runs.length;
    const guaranteed = runs.filter((r) => r.mockups.length >= 1).length / runs.length;
    expect(ok).toBeGreaterThanOrEqual(FULL_MIN);
    expect(guaranteed).toBeGreaterThanOrEqual(GUARANTEE_MIN);
  });
  it("AC-04-16 노출 집합 다양성 조건 충족 100%(노출 비폴백 후보 전부 eligible), 6개 후보 렌더 벡터 평균 쌍 거리 D ≥ candidatePairDistMin", () => {
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      const exposedIds = new Set(
        r.mockups.filter((m) => m.is_fallback === false).map((m) => String(m.candidate_id)),
      );
      for (const c of r.cands.filter((x) => exposedIds.has(String(x.id)))) {
        expect(c.eligible, `${r.case.id} ${r.jobId}`).toBe(true);
        const qr = c.quality_report as { hide_reason?: string } | null;
        expect(qr?.hide_reason, r.jobId).toBeUndefined();
      }
      // 후보별 렌더 L1 벡터(QualityReport.taste.v), 슬롯마다 최종 행 1개
      const bySlot = new Map<number, number[]>();
      for (const c of r.cands) {
        const v = (c.quality_report as { taste?: { v?: number[] } } | null)?.taste?.v;
        if (v) bySlot.set(num(c.slot), v);
      }
      const vs = [...bySlot.values()];
      expect(vs.length, `${r.case.id} 렌더 벡터 수`).toBe(6);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < vs.length; i++)
        for (let k = i + 1; k < vs.length; k++) {
          const a = vs[i] ?? [];
          const b = vs[k] ?? [];
          sum += Math.sqrt(a.reduce((s, x, d) => s + (x - (b[d] ?? 0)) ** 2, 0));
          n++;
        }
      expect(sum / n, `${r.case.id} D`).toBeGreaterThanOrEqual(PAIR_D_MIN);
    }
  });
  it("AC-08-25 골든 연속 실행에서 다른 가상 사용자의 브랜드명이 결과 카피에 출현 0건", () => {
    expect(runs.length).toBeGreaterThan(0);
    const names = [...new Set(CASES.map((c) => c.brand.name))];
    for (const r of runs) {
      const deck = JSON.stringify(r.row.copy_deck ?? {});
      const own = r.case.brand.name;
      for (const other of names) {
        if (other === own || own.includes(other)) continue;
        expect(deck.includes(other), `${r.case.id} 카피에 "${other}"`).toBe(false);
      }
    }
  });
  it("AC-01-30 생성 20회: 첫 카드 노출 p50 ≤ firstExposeP50Sec, 전체 p50 ≤ latencyP50Sec·p95 ≤ latencyP95Sec", async () => {
    const sample = runs.slice(0, LATENCY_SAMPLE);
    expect(sample).toHaveLength(LATENCY_SAMPLE);
    const first: number[] = [];
    const total: number[] = [];
    for (const r of sample) {
      const m = await P.rows("select min(created_at) as t from mockups where job_id = $1", [
        r.jobId,
      ]);
      first.push((ms(m[0]?.t) - ms(r.row.queued_at)) / 1000);
      total.push((ms(r.row.finished_at) - ms(r.row.queued_at)) / 1000);
    }
    expect(quantile(first, 0.5)).toBeLessThanOrEqual(FIRST_P50);
    expect(quantile(total, 0.5)).toBeLessThanOrEqual(ALL_P50);
    expect(quantile(total, 0.95)).toBeLessThanOrEqual(ALL_P95);
  });
  it("AC-01-32 killAtSec를 넘어 queued/running으로 남은 잡 0건", async () => {
    const left = await P.rows(
      `select id from generation_jobs where status in ('queued','running') and queued_at < now() - make_interval(secs => $1)`,
      [KILL_S],
    );
    expect(left).toHaveLength(0);
    for (const r of runs) {
      expect(["queued", "running"], r.jobId).not.toContain(r.row.status);
      expect((ms(r.row.finished_at) - ms(r.row.queued_at)) / 1000, r.jobId).toBeLessThanOrEqual(
        KILL_S,
      );
    }
  });
});
