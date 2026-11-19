// M1 수용 테스트: 데이터 계약·임시 시드·택소노미(09장 9.4.3 ①~④, AC-09-04·05, AC-02-01·12, AC-03-01, AC-05-03).
// 판정은 CLI(seed:temp·data:validate)와 packages/taxonomy 공개 API로만 한다. 해석 규칙은 ASSUMPTIONS ASM-008.
import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { thresholdNumber } from "../../../packages/config/src/index.js";
import { ROOT, edit, run, tmpRepo } from "../_support/sh.js";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const R01_KEYS = ["expression", "temperature", "shape", "density", "depth"];
const AXIS_IDS = ["A1", "A2", "A3", "A4", "A5"];

/** 09장 9.2.2 묶음 파일(B19 few-shot 제외, 0개 허용). 디렉터리형은 끝에 "/". */
const BUNDLE_PATHS = [
  "data/taxonomy/axes.json", // B1
  "data/taxonomy/types.json", // B2
  "data/taxonomy/presets/", // B3
  "data/taxonomy/purposes.json", // B4
  "data/taxonomy/mapping.json", // B5
  "data/fonts/registry.json", // B6
  "data/fonts/pairings.json", // B7
  "data/images/manifest.json", // B8
  "data/survey/templates.json", // B9
  "data/survey/card_plan.json", // B10
  "data/survey/ab_plan.json", // B11
  "data/survey/approvals.json", // B12
  "data/references/seed.json", // B13
  "data/linter/cliche_ko.json", // B14
  "data/linter/cliche_en.json", // B14
  "data/linter/examples/", // B15
  "data/golden/", // B16
  "legal/terms.md", // B17
  "legal/privacy.md", // B17
  "legal/sources.md", // B17
  "data/normalizers/", // B18
  "config/copy_templates.json", // B20
  "config/axis_hints.json", // B20
  "config/high_risk_brands.json", // B21
  "config/prohibited_categories.json", // B22
  "legal/processors.yaml", // B23
  "legal/data-flows.yaml", // B23
  "config/image_tag_keywords.json", // B24
  "data/taxonomy/text-roles.json", // B25
];

/** 03장 3.0 산출 파일 14종(AC-03-01). */
const CH03_FILES = [
  "data/taxonomy/taxonomy.json",
  "data/taxonomy/mapping.json",
  "data/taxonomy/presets/",
  "data/taxonomy/palettes.json",
  "data/taxonomy/purposes.json",
  "data/taxonomy/blocks.json",
  "data/taxonomy/components.json",
  "data/taxonomy/signatures.json",
  "data/taxonomy/harmony.json",
  "data/tokens/schema.json",
  "data/fonts/registry.json",
  "data/icons/map.json",
  "data/images/manifest.json",
  "data/taxonomy/text-roles.json",
];

/** id 형식을 다른 장이 정하지 않은(에이전트가 짓는) temp 묶음. 이 묶음의 모든 id는 tmp_로 시작한다(ASM-008). */
const FREE_ID_BUNDLES = [
  "data/fonts/registry.json",
  "data/fonts/pairings.json",
  "data/images/manifest.json",
  "data/references/seed.json",
];

const readJson = (dir: string, rel: string): Json =>
  JSON.parse(readFileSync(join(dir, rel), "utf8")) as Json;

/** 봉투면 items, 아니면 객체 자신을 1개 항목으로 본다. */
function itemsOf(j: Json): Obj[] {
  if (j && typeof j === "object" && !Array.isArray(j) && Array.isArray(j.items))
    return j.items as Obj[];
  return [j as Obj];
}
function filesUnder(dir: string, rel: string): string[] {
  const abs = join(dir, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs).flatMap((n) => filesUnder(dir, join(rel, n)));
}
const dirItems = (dir: string, rel: string): Obj[] =>
  filesUnder(dir, rel)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => itemsOf(readJson(dir, f)));

/** 시드 산출 전체(data/·legal/·config의 B20~24)의 경로→sha256. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of [...BUNDLE_PATHS, ...CH03_FILES, "data/"])
    for (const f of filesUnder(dir, p.replace(/\/$/, "")))
      out[relative(dir, join(dir, f))] = createHash("sha256")
        .update(readFileSync(join(dir, f)))
        .digest("hex");
  return out;
}

/** 03장 3.4.7 표(FINAL)에서 T1~T8 중심을 읽는다. */
function specCentroids(): number[][] {
  const md = readFileSync(join(ROOT, "docs/spec/FINAL/03_design_system.md"), "utf8");
  const sec = md.slice(md.indexOf("### 3.4.7"), md.indexOf("### 3.4.8"));
  return sec
    .split("\n")
    .filter((l) => /^\| T[1-8] \|/.test(l))
    .map((l) =>
      l
        .split("|")
        .slice(2, 7)
        .map((c) => Number(c.trim())),
    );
}
const dist = (a: number[], b: number[]): number =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0));
const centroidOf = (t: Obj): number[] => {
  const c = t.centroid;
  if (Array.isArray(c)) return c as number[];
  return R01_KEYS.map((k) => (c as Obj)[k] as number);
};

let dir = "";
let seed1: { code: number; out: string };
let snap1: Record<string, string> = {};

describe("M1 임시 시드·데이터 검증", () => {
  beforeAll(async () => {
    dir = tmpRepo();
    rmSync(join(dir, "data"), { recursive: true, force: true }); // Given data/가 비어 있음
    seed1 = await run("pnpm", ["-s", "seed:temp"], dir);
    snap1 = snapshot(dir);
  });

  it("AC-09-04: data/가 빈 상태에서 seed:temp && data:validate 성공, 9.2.2 전 묶음 생성", async () => {
    expect(seed1.code, seed1.out).toBe(0);
    for (const p of BUNDLE_PATHS) {
      expect(filesUnder(dir, p.replace(/\/$/, "")).length, p).toBeGreaterThan(0);
    }
    const v = await run("pnpm", ["-s", "data:validate"], dir);
    expect(v.code, v.out).toBe(0);
  });

  it("AC-09-04: temp 묶음은 provenance temp이고 자유 id 묶음의 모든 id가 tmp_로 시작", () => {
    for (const f of filesUnder(dir, "data").filter((x) => x.endsWith(".json"))) {
      const j = readJson(dir, f);
      if (j && typeof j === "object" && !Array.isArray(j) && "provenance" in j)
        expect(j.provenance, f).toBe("temp");
    }
    for (const f of FREE_ID_BUNDLES) {
      const items = itemsOf(readJson(dir, f));
      expect(items.length, f).toBeGreaterThan(0);
      for (const it of items) expect(String(it.id), f).toMatch(/^tmp_/);
    }
  });

  it("AC-09-04 / 9.4.3 ④: seed:temp 2회 실행 결과 바이트 동일", async () => {
    const r = await run("pnpm", ["-s", "seed:temp"], dir);
    expect(r.code, r.out).toBe(0);
    expect(snapshot(dir)).toEqual(snap1);
  });

  it("AC-09-05 / 9.4.3 ④: provenance human 프리셋 파일은 seed:temp 후에도 SHA-256 불변", async () => {
    const d = tmpRepo();
    rmSync(join(d, "data"), { recursive: true, force: true });
    expect((await run("pnpm", ["-s", "seed:temp"], d)).code).toBe(0);
    const presetFile = filesUnder(d, "data/taxonomy/presets").filter((f) => f.endsWith(".json"))[0];
    expect(presetFile).toBeDefined();
    const rel = presetFile ?? "";
    edit(d, rel, (s) => {
      const j = JSON.parse(s) as Obj;
      j.provenance = "human";
      j.preparedBy = "HU";
      return `${JSON.stringify(j, null, 2)}\n`;
    });
    const before = createHash("sha256")
      .update(readFileSync(join(d, rel)))
      .digest("hex");
    await run("pnpm", ["-s", "seed:temp"], d);
    const after = createHash("sha256")
      .update(readFileSync(join(d, rel)))
      .digest("hex");
    expect(after).toBe(before);
  });

  it("9.4.3 ②: 수량 — 축 5, 유형 8, 프리셋 8(유형당 앵커 1), 용도 3, 폰트 12·14, 페어링 20, 카드 48, A/B 120, 레퍼런스 60, 골든 32", () => {
    const axes = itemsOf(readJson(dir, "data/taxonomy/axes.json"));
    expect(axes.map((a) => a.id).sort()).toEqual(AXIS_IDS);
    const types = itemsOf(readJson(dir, "data/taxonomy/types.json"));
    expect(types).toHaveLength(8);
    const presets = dirItems(dir, "data/taxonomy/presets");
    expect(presets).toHaveLength(8);
    for (const t of types) {
      const anchors = presets.filter((p) => p.typeId === t.id && p.id === t.anchorPresetId);
      expect(anchors, String(t.id)).toHaveLength(1);
    }
    expect(new Set(types.map((t) => t.anchorPresetId)).size).toBe(8);
    expect(
      itemsOf(readJson(dir, "data/taxonomy/purposes.json"))
        .map((p) => p.id)
        .sort(),
    ).toEqual(["local_business", "portfolio", "saas"]);
    const fonts = itemsOf(readJson(dir, "data/fonts/registry.json"));
    expect(fonts.filter((f) => f.script === "hangul")).toHaveLength(12);
    expect(fonts.filter((f) => f.script === "latin")).toHaveLength(14);
    const script = new Map(fonts.map((f) => [f.id, f.script]));
    const pairings = itemsOf(readJson(dir, "data/fonts/pairings.json"));
    expect(pairings).toHaveLength(20);
    for (const p of pairings)
      expect(
        [script.get(p.headingFontId), script.get(p.bodyFontId)].includes("hangul"),
        String(p.id),
      ).toBe(true);
    expect(itemsOf(readJson(dir, "data/survey/card_plan.json"))).toHaveLength(48);
    expect(itemsOf(readJson(dir, "data/survey/ab_plan.json"))).toHaveLength(120);
    expect(itemsOf(readJson(dir, "data/references/seed.json"))).toHaveLength(60);
    const golden = dirItems(dir, "data/golden");
    expect(golden).toHaveLength(32);
    for (const g of golden) {
      expect(g.answers ?? null).toBeNull();
      expect(((g.expected ?? {}) as Obj).muRef ?? null).toBeNull();
    }
  });

  it("AC-02-01: 축 5개가 R-01 키를 쓰고 SV 16·카드 48·A/B 120이며 data:validate가 zod 검증을 통과", async () => {
    const axes = itemsOf(readJson(dir, "data/taxonomy/axes.json"));
    const keys = axes.map((a) => R01_KEYS.find((k) => Object.values(a).includes(k)));
    expect(keys.sort()).toEqual([...R01_KEYS].sort());
    const { loadTaxonomy } = await import("../../../packages/taxonomy/src/index.js");
    const tax = loadTaxonomy(dir);
    expect(tax.standardVectors).toHaveLength(16);
    expect(tax.cardPlan).toHaveLength(48);
    expect(tax.abPlan).toHaveLength(120);
  });

  it("AC-02-01 / 9.4.3 ③: 유형 centroid가 03장 3.4.7 표와 일치", () => {
    const types = itemsOf(readJson(dir, "data/taxonomy/types.json"));
    const spec = specCentroids();
    expect(spec).toHaveLength(8);
    const got = types.map(centroidOf);
    for (const c of spec) expect(got).toContainEqual(c);
  });

  it("AC-02-12 / 9.4.3 ③: 중심 쌍별 최소 거리 ≥ diagnosis.typeCenterMinDist, 자기 유형 판정 8/8, 브리지 규칙 1~3", async () => {
    const { loadTaxonomy, classifyType, checkBridgeRules } =
      await import("../../../packages/taxonomy/src/index.js");
    const tax = loadTaxonomy(dir);
    const cs = tax.types.map((t) => ({ id: t.id, c: [...t.centroid] }));
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++)
        min = Math.min(min, dist(cs[i]?.c ?? [], cs[j]?.c ?? []));
    expect(min).toBeGreaterThanOrEqual(thresholdNumber("diagnosis.typeCenterMinDist"));
    for (const t of cs) expect(classifyType(tax, t.c)).toBe(t.id);
    expect(checkBridgeRules(tax)).toEqual([]);
  });

  it("AC-03-01: 03장 산출 파일 14종이 존재하고 data:validate가 zod·참조 무결성 오류 0", async () => {
    for (const p of CH03_FILES)
      expect(filesUnder(dir, p.replace(/\/$/, "")).length, p).toBeGreaterThan(0);
    const v = await run("pnpm", ["-s", "data:validate"], dir);
    expect(v.code, v.out).toBe(0);
  });

  it("AC-03-01 / 9.4.3 ①: 프리셋의 존재하지 않는 pairing 참조(고아)는 data:validate 실패", async () => {
    const d = tmpRepo();
    rmSync(join(d, "data"), { recursive: true, force: true });
    expect((await run("pnpm", ["-s", "seed:temp"], d)).code).toBe(0);
    const f = join(d, "data/fonts/pairings.json");
    const j = JSON.parse(readFileSync(f, "utf8")) as Obj;
    (j.items as Obj[]).pop(); // 마지막 페어링 삭제 → 그 페어링을 쓰는 참조가 고아가 되거나 수량 불일치
    writeFileSync(f, `${JSON.stringify(j, null, 2)}\n`);
    const v = await run("pnpm", ["-s", "data:validate"], d);
    expect(v.code).not.toBe(0);
    expect(v.out).toContain("pairings");
  });

  it("AC-05-03: candidates.csv·observations/*.csv에 플랫폼 설명·평점·이미지 열이 있으면 data:validate 실패", async () => {
    const d = tmpRepo();
    rmSync(join(d, "data"), { recursive: true, force: true });
    expect((await run("pnpm", ["-s", "seed:temp"], d)).code).toBe(0);
    const ok =
      "url,tier,source_id,use,lang_guess,era_guess,redesigned_at,maker,found_at,note\n" +
      "https://tmp-ref-01.invalid/,T1,tmp_src,saas,ko,current,,,2026-11-01,\n";
    edit(d, "data/seed/candidates.csv", () => ok);
    edit(d, "data/observations/2026-10.csv", () => ok);
    const pass = await run("pnpm", ["-s", "data:validate"], d);
    expect(pass.code, pass.out).toBe(0);
    for (const [rel, col] of [
      ["data/seed/candidates.csv", "rating"],
      ["data/observations/2026-10.csv", "description"],
      ["data/observations/2026-10.csv", "image_url"],
    ] as const) {
      edit(d, rel, () => ok.replace("note\n", `note,${col}\n`).replace(",\n", ",,x\n"));
      const bad = await run("pnpm", ["-s", "data:validate"], d);
      expect(bad.code, `${rel}:${col}`).not.toBe(0);
      expect(bad.out).toContain(col);
      edit(d, rel, () => ok);
    }
  });
});
