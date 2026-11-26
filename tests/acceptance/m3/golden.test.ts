// M3 수용 테스트(5/5): 폴백 72·골든 노출 시안 품질, 상충 픽스처, 프리셋 린트 매트릭스, 원본 유사도 운영
// (09장 9.4.5 ②, 04장 4.6.3·4.12, 03장 AC-03-39·43, AC-04-13, AC-08-13~16). API 계약은 ASSUMPTIONS ASM-081.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildFallback,
  compileSpecs,
  editChoices,
  fallbackMockup,
  loadDesignData,
  standardTree,
} from "../../../packages/design-spec/src/index.js";
import { compilePage } from "../../../packages/renderer/src/index.js";
import { COPY_RULES, copyRules } from "../../../packages/linter/src/index.js";
import { harmonyScore, loadOriginalityConfig } from "../../../packages/scoring/src/index.js";
import { assemblePrompt } from "../../../packages/llm/src/index.js";
import { openHarness, type Harness } from "../../../apps/worker/src/render/harness.js";
import { evaluateCandidate } from "../../../apps/worker/src/quality/evaluate.js";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT, commit, run, tmpRepo } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const data = loadDesignData(ROOT);
const TYPES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PURPOSES = ["saas", "local_business", "portfolio"] as const;
const VARIANTS = ["v_true", "v_fit", "v_bal"] as const;
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const H_FLOOR = thresholdNumber("generation.harmonyFloor");
const CF_IDS = Array.from({ length: 12 }, (_, i) => `CF-${String(i + 1).padStart(2, "0")}`);

let h: Harness;
beforeAll(async () => {
  h = await openHarness();
});
afterAll(async () => {
  await h?.close();
});

const failedGates = (rep: { hard: { id: string; status: string }[] }): string[] =>
  rep.hard.filter((g) => g.status !== "pass").map((g) => g.id);

describe("9.4.5 ② · AC-04-25 폴백 시안 72개: G-01~G-13 통과, H ≥ harmonyFloor(TM·S_free 면제)", () => {
  it("8유형 × 3용도 × 3변형", async () => {
    const bad: string[] = [];
    let n = 0;
    for (const t of TYPES)
      for (const p of PURPOSES)
        for (const v of VARIANTS) {
          const { spec, tree } = fallbackMockup(t, p, v, data);
          const { html } = compilePage(spec, tree, data);
          const { report } = await evaluateCandidate(h, { spec, tree, html }, data, {
            fallback: true,
          });
          const fg = failedGates(report);
          if (fg.length) bad.push(`${t}/${p}/${v} gates ${fg.join(",")}`);
          if (report.harmony < H_FLOOR) bad.push(`${t}/${p}/${v} H ${report.harmony}`);
          expect(report.hard.map((g) => g.id).sort()).toEqual(
            Array.from({ length: 13 }, (_, i) => `G-${String(i + 1).padStart(2, "0")}`),
          );
          n++;
        }
    expect(n).toBe(72);
    expect(bad).toEqual([]);
  }, 3_600_000);
});

interface Golden {
  id: string;
  purpose: string;
  persona: { thetaStar: Record<string, number> };
  brand: Obj;
  expected: { typeId: string };
}
const goldens = (): Golden[] =>
  readdirSync(join(ROOT, "data/golden"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(ROOT, "data/golden", f), "utf8")) as Golden);

/** M3 골든 노출 시안 = 변형별 결정론 폴백(브랜드 템플릿 카피, LLM 0회, ASM-081). */
function goldenMockups(g: Golden): { variant: string; spec: unknown; tree: unknown }[] {
  const mu = Object.fromEntries(KEYS.map((k) => [k, g.persona.thetaStar[k]!]));
  const sigma = Object.fromEntries(KEYS.map((k) => [k, 0.08]));
  const specs = compileSpecs(
    {
      taste: { mu, sigma, kappa: 0.8, insensitive_axes: [], type_id: g.expected.typeId } as never,
      purpose: g.purpose as never,
      brand: g.brand as never,
      jobSeed: `golden-${g.id}`,
    },
    data,
  );
  return VARIANTS.map((v) => {
    const { spec, tree } = buildFallback(
      { typeId: g.expected.typeId, purpose: g.purpose, variant: v, spec: specs[v], brand: g.brand },
      data,
    );
    return { variant: v, spec, tree };
  });
}

describe("AC-04-13 골든 노출 시안 CP-01~CP-12 위반 0(CP-06 비율 기준)", () => {
  it("규칙 목록 = 4.6.3 CP-01~CP-12", () => {
    expect([...COPY_RULES].sort()).toEqual(
      Array.from({ length: 12 }, (_, i) => `CP-${String(i + 1).padStart(2, "0")}`),
    );
  });
  it("골든 32 × 3", () => {
    const gs = goldens();
    expect(gs.length).toBe(32);
    const bad: string[] = [];
    for (const g of gs)
      for (const m of goldenMockups(g))
        for (const x of copyRules(m.tree, { brand: g.brand, spec: m.spec }))
          bad.push(`${g.id}/${m.variant} ${x.rule} ${x.message}`);
    expect(bad).toEqual([]);
  });
  it("위반 감지 확인: 브랜드명 변형(CP-01)·템플릿 잔여물(CP-12)", () => {
    const g = goldens()[0]!;
    const m = goldenMockups(g)[0]!;
    const name = String(g.brand.name);
    const swap = (s: string): unknown => JSON.parse(JSON.stringify(m.tree).split(name).join(s));
    expect(
      copyRules(swap(`${name}s`), { brand: g.brand, spec: m.spec }).map((x) => x.rule),
    ).toContain("CP-01");
    const lorem = JSON.parse(
      JSON.stringify(m.tree).replace(/"text":"([^"]*)"/, '"text":"Lorem ipsum dolor"'),
    ) as unknown;
    expect(copyRules(lorem, { brand: g.brand, spec: m.spec }).map((x) => x.rule)).toContain(
      "CP-12",
    );
  });
});

describe("AC-08-13 골든 노출 시안 원본 유사도 위반 0, 모든 후보 OriginalityReport", () => {
  it("골든 32 × 3", async () => {
    const cfg = loadOriginalityConfig(ROOT);
    const bad: string[] = [];
    for (const g of goldens())
      for (const m of goldenMockups(g)) {
        const { html } = compilePage(m.spec as never, m.tree as never, data);
        const { report } = await evaluateCandidate(h, { spec: m.spec, tree: m.tree, html }, data, {
          fallback: true,
        });
        const o = report.originality;
        expect(o.config_version).toBe(cfg.version);
        for (const k of [
          "passed",
          "violated",
          "nearest_reference_id",
          "g2_matches",
          "g2_matched_attrs",
          "min_phash_distance",
          "min_phash_reference_id",
          "g5_max_run",
        ])
          expect(Object.keys(o), k).toContain(k);
        if (!o.passed) bad.push(`${g.id}/${m.variant} ${o.violated.join(",")}`);
      }
    expect(bad).toEqual([]);
  }, 3_600_000);
});

describe("AC-08-14 cluster_median 프리셋 eTLD+1 < g1_min_domains → 시드 검증 실패", () => {
  const withDomains = async (domains: string[]): Promise<number> => {
    const d = tmpRepo();
    const f = join(d, "data/taxonomy/presets/PS-T1.json");
    const j = JSON.parse(readFileSync(f, "utf8")) as { items: Obj[] };
    j.items[0]!.provenance = { method: "cluster_median", domains };
    writeFileSync(f, `${JSON.stringify(j, null, 2)}\n`);
    commit(d);
    return (await run("pnpm", ["-s", "data:validate"], d)).code;
  };
  it("서로 다른 eTLD+1 2개(서브도메인·co.kr 공개 접미사 처리)는 실패, 3개는 통과", async () => {
    expect(await withDomains(["www.example.com", "shop.example.com", "a.co.kr"])).not.toBe(0);
    expect(await withDomains(["a.co.kr", "b.co.kr", "shop.example.com"])).toBe(0);
  }, 300_000);
});

describe("AC-08-15 프롬프트 조립 출력에 reference_* 유래 문자열 0", () => {
  it("gen_copy·gen_layout", () => {
    const g = goldens()[0]!;
    const m = goldenMockups(g)[0]!;
    const refs = (
      JSON.parse(readFileSync(join(ROOT, "data/references/seed.json"), "utf8")) as { items: Obj[] }
    ).items.slice(0, 5);
    const strings = refs.flatMap((r) =>
      ["url", "domain", "titleKo", "badgeKo", "id"]
        .map((k) => r[k])
        .filter((x): x is string => typeof x === "string"),
    );
    expect(strings.length).toBeGreaterThan(0);
    for (const role of ["gen_copy", "gen_layout"] as const) {
      // 파이프라인이 실수로 레퍼런스를 넘겨도 조립 결과에 들어가지 않아야 한다
      const out = assemblePrompt(role, {
        brand: g.brand,
        spec: m.spec,
        purpose: g.purpose,
        references: refs,
      });
      const text = JSON.stringify(out);
      expect(text.length).toBeGreaterThan(0);
      for (const s of strings) expect(text.includes(s), `${role}: ${s}`).toBe(false);
    }
  });
});

describe("AC-08-16 원본 유사도 보정 보고서(8.3.4)", () => {
  it("eval/originality/report-<version>.md 존재, 2인 라벨, '예' 0건", () => {
    const cfg = loadOriginalityConfig(ROOT);
    const p = join(ROOT, `eval/originality/report-${cfg.version}.md`);
    expect(existsSync(p), p).toBe(true);
    const md = readFileSync(p, "utf8");
    const yes = /yes_count:\s*(\d+)/.exec(md);
    const labelers = /labelers:\s*(\d+)/.exec(md);
    const prov = /provenance:\s*(\w+)/.exec(md);
    expect(prov?.[1]).toBe("human");
    expect(Number(labelers?.[1] ?? 0)).toBe(2); // 8.3.4 ② 운영자 포함 2인
    expect(Number(yes?.[1] ?? -1)).toBe(0);
  });
});

describe("AC-03-39 표준 트리 H = 100·상충 0, CF-01~12 위반 픽스처 H < harmonyFloor", () => {
  it("표준 트리 24", () => {
    for (const t of TYPES)
      for (const p of PURPOSES) {
        const { spec, tree } = standardTree(t, p, data);
        const r = harmonyScore(spec, tree);
        expect(r.total, `${t}/${p}`).toBe(100);
        expect(r.conflicts, `${t}/${p}`).toEqual([]);
      }
  });
  it("CF 픽스처(packages/scoring/fixtures/conflicts/CF-xx/*.json)", () => {
    for (const cf of CF_IDS) {
      const dir = join(ROOT, "packages/scoring/fixtures/conflicts", cf);
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
      expect(files.length, cf).toBeGreaterThanOrEqual(1);
      for (const f of files) {
        const fx = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
          cf: string;
          spec: Json;
          tree: Json;
        };
        expect(fx.cf).toBe(cf);
        const r = harmonyScore(fx.spec, fx.tree);
        expect(r.conflicts, `${cf}/${f}`).toContain(cf);
        expect(r.total, `${cf}/${f}`).toBeLessThan(H_FLOOR);
      }
    }
  });
});

describe("AC-03-43 presets:lint-matrix", () => {
  it("프리셋별 조합 수 > 0, 미등록 조합 AIL error 0, CF-13 이후 등록 값은 편집 선택지 disabled", async () => {
    const out = "reports/presets-lint-matrix.json";
    const r = await run("pnpm", ["-s", "presets:lint-matrix", "--json", out], ROOT);
    expect(r.code, r.out.slice(-600)).toBe(0);
    const rep = JSON.parse(readFileSync(join(ROOT, out), "utf8")) as {
      presets: {
        presetId: string;
        combos: number;
        errors: { key: string; value: string; rules: string[]; cf: string | null }[];
      }[];
    };
    expect(rep.presets.map((p) => p.presetId).sort()).toEqual(data.presets.map((p) => p.id).sort());
    const harmony = JSON.parse(readFileSync(join(ROOT, "data/taxonomy/harmony.json"), "utf8")) as {
      conflicts: { id: string; preset?: string; key?: string; value?: string }[];
    };
    for (const p of rep.presets) {
      expect(p.combos, p.presetId).toBeGreaterThan(0);
      for (const e of p.errors)
        expect(e.cf, `${p.presetId} ${e.key}=${e.value} 미등록`).toMatch(/^CF-(1[3-9]|[2-9]\d)$/);
    }
    for (const c of harmony.conflicts.filter((x) => Number(x.id.slice(3)) >= 13)) {
      const preset = data.presets.find((x) => x.id === c.preset);
      expect(preset, c.id).toBeDefined();
      if (!preset) continue;
      const { spec } = standardTree(preset.typeId, "saas", data);
      const choice = editChoices(spec, data).find((x) => x.key === c.key && x.value === c.value);
      expect(choice?.disabled, `${c.id} ${c.key}=${c.value}`).toBe(true);
    }
  }, 3_600_000);
});
