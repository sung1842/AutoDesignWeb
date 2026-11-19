// pnpm seed:temp (09장 9.2.4). 파일이 없거나 provenance temp인 묶음만 생성·덮어쓴다. human 파일은 쓰지 않는다.
//   결정성: 난수는 mulberry32(20261116)만, 시각·작성자 표기는 고정값 → 2회 실행 결과 바이트 동일.
//   다른 장에 값이 있으면 FINAL 장에서 그대로 옮긴다(spec-md.ts).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Json, Obj } from "./load.js";
import { chapter, section, table, unquote } from "./spec-md.js";

export const SEED = 20261116;
/** 봉투 preparedAt(결정성을 위해 시드 날짜로 고정). */
export const PREPARED_AT = "2026-11-16T00:00:00Z";
/** taxonomyVersion: DB `taxonomy_releases.version`(06장 CHECK `YYYY-S[1-4]`)과 같은 시즌 ID(ASM-010). */
export const TAXONOMY_VERSION = "2026-S4";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Ctx {
  root: string;
  preparedBy: string;
  rand: () => number;
}
export interface Out {
  path: string;
  content: string;
}

/** spec-lock 커밋(장 원천 버전)을 작성자 표기에 쓴다. 없으면 HEAD. */
function preparedBy(root: string): string {
  const rev = (ref: string): string =>
    execFileSync("git", ["rev-list", "-n1", ref], { cwd: root, encoding: "utf8" }).trim();
  let sha: string;
  try {
    sha = rev("spec-lock");
  } catch {
    sha = rev("HEAD");
  }
  return `seed:temp@${sha.slice(0, 7)}`;
}

export const stable = (j: Json): string => `${JSON.stringify(j, null, 2)}\n`;

export function bundle(ctx: Ctx, name: string, items: Json[]): string {
  return stable({
    bundle: name,
    schemaVersion: 1,
    taxonomyVersion: TAXONOMY_VERSION,
    provenance: "temp",
    preparedAt: PREPARED_AT,
    preparedBy: ctx.preparedBy,
    items,
  });
}

// ---------- B1 축 (02장 2.1.1 + 2.2 축 이름) ----------
function genAxes(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "02_diagnosis.md");
  const names = new Map(
    md
      .split("\n")
      .map((l) => /^\| (A[1-5]) (\S+) \|/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
  const items = table(section(md, "### 2.1.1")).map((r) => {
    const [low = "", high = ""] = (r[2] ?? "").split("↔").map((s) => s.trim());
    return {
      id: r[0] ?? "",
      key: unquote(r[1] ?? ""),
      nameKo: names.get(r[0] ?? "") ?? "",
      lowLabelKo: low,
      highLabelKo: high,
    };
  });
  return [{ path: "data/taxonomy/axes.json", content: bundle(ctx, "axes", items) }];
}

// ---------- B2 유형 (02장 2.11 텍스트 + 03장 3.4.7 중심) ----------
export function specCentroids(root: string): Map<string, number[]> {
  const rows = table(section(chapter(root, "03_design_system.md"), "### 3.4.7"));
  return new Map(rows.map((r) => [r[0] ?? "", r.slice(1, 6).map(Number)]));
}

function genTypes(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "02_diagnosis.md");
  const t1 = table(section(md, "### 2.11.1"));
  const t2 = new Map(table(section(md, "### 2.11.2")).map((r) => [r[0] ?? "", r]));
  const desc = new Map(
    section(md, "### 2.11.2")
      .split("\n")
      .map((l) => /^- \*\*(T[1-8]) [^*]+\*\* — (.+)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1] ?? "", (m[2] ?? "").trim()]),
  );
  const cents = specCentroids(ctx.root);
  const items = t1.map((r) => {
    const id = r[0] ?? "";
    const row2 = t2.get(id) ?? [];
    return {
      id,
      slug: r[1] ?? "",
      nameKo: r[2] ?? "",
      summaryKo: row2[1] ?? "",
      descriptionKo: desc.get(id) ?? "",
      strengthsKo: (row2[2] ?? "").split("/").map((s) => s.trim()),
      keywordsKo: (r[3] ?? "").split(",").map((s) => s.trim()),
      centroid: cents.get(id) ?? [],
      anchorPresetId: r[4] ?? "",
      goodPurposes: (r[5] ?? "").split(",").map((s) => s.trim()),
    };
  });
  return [{ path: "data/taxonomy/types.json", content: bundle(ctx, "types", items) }];
}

// ---------- B4 용도 (03장 3.6.5 표 그대로, axisClip은 03장에 없어 [0,1], 9.2.4) ----------
function genPurposes(ctx: Ctx): Out[] {
  const clip = Object.fromEntries(["A1", "A2", "A3", "A4", "A5"].map((a) => [a, [0, 1]]));
  const items: Obj[] = [
    {
      id: "saas",
      nameKo: "SaaS·앱 소개",
      requiredSections: ["hero", "cta"],
      requiredAny: ["value", "feature"],
      optionalSections: [
        "value",
        "feature",
        "showcase",
        "stats",
        "process",
        "proof",
        "pricing",
        "faq",
      ],
      forbiddenSections: ["menu", "highlight", "gallery", "location", "story"],
      sectionCount: [6, 8],
      standardHero: ["split", "left-aligned"],
      forbiddenL2: [],
      axisClip: clip,
      imageTags: ["saas.*", "common.*"],
      defaultImageTag: "saas.architecture",
    },
    {
      id: "local_business",
      nameKo: "가게 소개(카페·식당·공방)",
      requiredSections: ["hero", "menu", "location"],
      requiredAny: [],
      optionalSections: [
        "highlight",
        "gallery",
        "story",
        "about",
        "proof",
        "faq",
        "cta",
        "contact",
      ],
      forbiddenSections: ["pricing", "process", "showcase", "value"],
      sectionCount: [6, 7],
      standardHero: ["full-bleed-image", "split"],
      forbiddenL2: [
        { key: "media.mode", value: "type-led", replace: "photo-led", noPhoto: "shape-graphic" },
      ],
      axisClip: clip,
      imageTags: ["local_business.*", "common.*"],
      defaultImageTag: "local_business.storefront",
    },
    {
      id: "portfolio",
      nameKo: "포트폴리오",
      requiredSections: ["hero", "gallery", "contact"],
      requiredAny: [],
      optionalSections: ["about", "service", "showcase", "stats", "proof", "process", "cta"],
      forbiddenSections: ["menu", "location", "pricing"],
      sectionCount: [5, 7],
      standardHero: ["type-only", "split"],
      forbiddenL2: [],
      axisClip: clip,
      imageTags: ["portfolio.*", "common.*"],
      defaultImageTag: "portfolio.studio",
    },
  ];
  return [{ path: "data/taxonomy/purposes.json", content: bundle(ctx, "purposes", items) }];
}

// ---------- C03 taxonomy.json (03장 3.2.1 표 + 3.2.2 값별 L1 기여) ----------
/** 3.2.2 predictL1의 값 사전형 항(키 → 축·항 이름·가중치·값 사전). 공식 블록을 그대로 옮김. */
const L1_CONTRIB: Record<string, { axis: string; term: string; weight: number; map: Obj }[]> = {
  "layout.grid_mode": [
    { axis: "A1", term: "asym", weight: 0.15, map: { symmetric: 0, bento: 0.5, asymmetric: 1 } },
  ],
  "shape.radius_family": [
    {
      axis: "A3",
      term: "radius",
      weight: 0.6,
      map: { sharp: 0, soft: 0.333, round: 0.667, pill: 1 },
    },
    { axis: "A3", term: "pill", weight: 0.15, map: { sharp: 0, soft: 0, round: 0.5, pill: 1 } },
  ],
  "shape.border": [
    { axis: "A3", term: "borderSoft", weight: 0.25, map: { bold: 0, hairline: 0.5, none: 1 } },
  ],
  "space.density": [
    { axis: "A4", term: "density", weight: 0.75, map: { airy: 0, regular: 0.5, compact: 1 } },
  ],
  "type.body_size": [
    { axis: "A4", term: "text", weight: 0.25, map: { "18": 0, "17": 0.5, "16": 1 } },
  ],
  "depth.style": [
    {
      axis: "A5",
      term: "style",
      weight: 0.55,
      map: {
        flat: 0,
        "subtle-shadow": 0.35,
        "layered-shadow": 0.65,
        "brutal-offset": 0.75,
        glass: 1,
      },
    },
  ],
  "depth.shadow_level": [
    { axis: "A5", term: "level", weight: 0.45, map: { "0": 0, "1": 0.333, "2": 0.667, "3": 1 } },
  ],
};

/** 값 셀의 백틱 토큰을 펼친다(FP01~FP20, PAL-T{n}-{0..3}). */
export function expandValues(cell: string): string[] {
  const toks = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
  if (toks[0] === "FP01" && toks[1] === "FP20")
    return Array.from({ length: 20 }, (_, i) => `FP${String(i + 1).padStart(2, "0")}`);
  if (toks[0] === "PAL-T{n}-{0..3}")
    return Array.from({ length: 32 }, (_, i) => `PAL-T${Math.floor(i / 4) + 1}-${i % 4}`);
  return toks;
}

const CATEGORICAL_KEYS = ["type.pairing_id", "color.palette_id", "media.mode", "icon.set"];

function genTaxonomy(ctx: Ctx): Out[] {
  const rows = table(section(chapter(ctx.root, "03_design_system.md"), "### 3.2.1"));
  let category = "";
  const items = rows.map((r) => {
    if ((r[1] ?? "") !== "〃") category = r[1] ?? "";
    const id = unquote(r[2] ?? "");
    const raw = r[3] ?? "";
    // "(`expressive` MVP 제외)" 같은 제외 괄호는 값 목록에서 뺀다.
    const excl = /\(([^)]*제외[^)]*)\)/.exec(raw);
    const cell = excl ? raw.replace(excl[0], "") : raw;
    const note = /\(([^)]*)\)\s*$/.exec(cell.replace(/`[^`]*`/g, ""))?.[1] ?? "";
    const item: Obj = {
      id,
      order: Number(r[0]),
      category,
      values: expandValues(cell),
      // 범주형 = 3.3.2 "범주형 키"(서수 이동 없음)
      ordinal: !CATEGORICAL_KEYS.includes(id),
      editControl: r[4] ?? "",
    };
    if (note && note !== "범주형") item.noteKo = note;
    if (excl) item.excludedMvp = expandValues(excl[1] ?? "");
    const c = L1_CONTRIB[id];
    if (c) item.l1Contribution = c;
    return item;
  });
  return [{ path: "data/taxonomy/taxonomy.json", content: bundle(ctx, "taxonomy", items) }];
}

// ---------- B5 mapping.json (03장 3.3.2 서수 표 + 범주형 규칙) ----------
function genMapping(ctx: Ctx): Out[] {
  const rows = table(section(chapter(ctx.root, "03_design_system.md"), "### 3.3.2"));
  const ordinal: Obj[] = rows.map((r) => {
    const k = r[3] ?? "";
    const item: Obj = {
      id: unquote(r[0] ?? ""),
      kind: "ordinal",
      axis: r[1] ?? "",
      sign: (r[2] ?? "") === "−" || (r[2] ?? "") === "-" ? -1 : 1,
      k: /^\d+$/.test(k) ? Number(k) : null,
    };
    if (!/^\d+$/.test(k)) item.kRuleKo = k.replace(/^\(|\)$/g, "");
    if (r[4]) item.noteKo = r[4];
    return item;
  });
  const categorical: Obj[] = [
    {
      id: "type.pairing_id",
      kind: "categorical",
      rule: "sig-nearest",
      targetAxes: ["A2", "A1", "A3"],
      sigKeys: ["temp", "expr", "soft"],
      weights: [0.5, 0.25, 0.25],
      tieEpsilon: 1e-6,
      tieBreak: ["anchor", "idAsc"],
    },
    {
      id: "color.palette_id",
      kind: "categorical",
      rule: "palette-warm-chroma",
      warmAxis: "A2",
      chromaAxis: "A1",
      chromaWeight: 0.5,
      tieBreak: ["PAL-0"],
    },
    { id: "media.mode", kind: "categorical", rule: "anchor", purposeForbiddenReplace: true },
    { id: "icon.set", kind: "categorical", rule: "anchor" },
  ];
  const items = [...ordinal, ...categorical];
  return [{ path: "data/taxonomy/mapping.json", content: bundle(ctx, "mapping", items) }];
}

/** 생성기 목록(의존 순서). 나머지 묶음은 M1-04b 이후 단위에서 추가한다. */
export const GENERATORS: ((ctx: Ctx) => Out[])[] = [
  genAxes,
  genTypes,
  genPurposes,
  genTaxonomy,
  genMapping,
];

function isHuman(abs: string): boolean {
  if (!existsSync(abs) || !abs.endsWith(".json")) return false;
  try {
    const j = JSON.parse(readFileSync(abs, "utf8")) as Obj;
    return j.provenance === "human";
  } catch {
    return false;
  }
}

export function seedTemp(root: string): { written: string[]; skippedHuman: string[] } {
  const ctx: Ctx = { root, preparedBy: preparedBy(root), rand: mulberry32(SEED) };
  const written: string[] = [];
  const skippedHuman: string[] = [];
  for (const gen of GENERATORS)
    for (const o of gen(ctx)) {
      const abs = join(root, o.path);
      if (isHuman(abs)) {
        skippedHuman.push(o.path);
        continue;
      }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, o.content);
      written.push(o.path);
    }
  return { written, skippedHuman };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = seedTemp(process.cwd());
  for (const p of r.skippedHuman) process.stdout.write(`skip(human) ${p}\n`);
  process.stdout.write(
    `seed:temp: ${r.written.length}개 파일 생성, human 건너뜀 ${r.skippedHuman.length}\n`,
  );
}
