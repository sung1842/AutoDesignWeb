// pnpm seed:temp (09장 9.2.4). 파일이 없거나 provenance temp인 묶음만 생성·덮어쓴다. human 파일은 쓰지 않는다.
//   결정성: 난수는 mulberry32(20261116)만, 시각·작성자 표기는 고정값 → 2회 실행 결과 바이트 동일.
//   다른 장에 값이 있으면 FINAL 장에서 그대로 옮긴다(spec-md.ts).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Json, Obj } from "./load.js";
import {
  type Oklch,
  contrast,
  fitGamut,
  oklchToHex,
  parseOklch,
} from "../../packages/taxonomy/src/color.js";
import {
  type L1,
  type MapData,
  type PresetLite,
  mapL1toL2,
} from "../../packages/taxonomy/src/map.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { chapter, section, table, unquote } from "./spec-md.js";
import { CONFIG_GENERATORS } from "./seed-config.js";

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

export function taxonomyItems(root: string): Obj[] {
  const rows = table(section(chapter(root, "03_design_system.md"), "### 3.2.1"));
  let category = "";
  return rows.map((r) => {
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
}

function genTaxonomy(ctx: Ctx): Out[] {
  const items = taxonomyItems(ctx.root);
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

// ---------- B3 presets/<id>.json (03장 3.4.1·3.4.4·3.4.5·3.4.6·3.4.7·3.6.6) ----------
const splitList = (c: string): string[] =>
  c
    .split(",")
    .map((x) => x.replace(/\*\*/g, "").trim())
    .filter((x) => x.length > 0);

/** 3.4.5 표의 짧은 키 → L2 키. */
const ALLOWED_KEY: Record<string, string> = {
  pairing: "type.pairing_id",
  scale_ratio: "type.scale_ratio",
  display_boost: "type.display_boost",
  body_size: "type.body_size",
  body_leading: "type.body_leading",
  radius_family: "shape.radius_family",
  border: "shape.border",
  "depth.style": "depth.style",
  shadow_level: "depth.shadow_level",
  density: "space.density",
  container: "space.container",
  grid_mode: "layout.grid_mode",
  "media.mode": "media.mode",
  "media.treatment": "media.treatment",
  "motion.level": "motion.level",
  headline_weight: "type.headline_weight",
};

function genPresets(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "03_design_system.md");
  const tax = new Map(taxonomyItems(ctx.root).map((t) => [String(t.id), t]));
  const meta = table(section(md, "### 3.4.1"));
  const l2rows = table(section(md, "### 3.4.4"));
  const allowRows = table(section(md, "### 3.4.5"));
  const scaleRows = new Map(table(section(md, "### 3.4.6")).map((r) => [r[0] ?? "", r]));
  const scaleHead = ["caption", "small", "body", "lead", "h4", "h3", "h2", "h1", "display"];
  const blockRows = new Map(table(section(md, "### 3.6.6")).map((r) => [r[0] ?? "", r]));
  const cents = specCentroids(ctx.root);
  const row4 = (label: string): string[] => l2rows.find((r) => unquote(r[0] ?? "") === label) ?? [];
  const sortOrd = (key: string, vals: string[]): string[] => {
    const t = tax.get(key);
    if (!t || !t.ordinal) return vals;
    const order = t.values as string[];
    return [...vals].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };
  return meta.map((m, i) => {
    const typeId = m[0] ?? "";
    const n = i + 1;
    const id = m[2] ?? "";
    const col = 1 + i;
    const l2: Record<string, string> = {};
    for (const k of tax.keys()) l2[k] = row4(k)[col] ?? "";
    const allowed: Record<string, string[]> = {};
    for (const r of allowRows) {
      const key = ALLOWED_KEY[r[0] ?? ""];
      if (!key) throw new Error(`3.4.5 알 수 없는 키 ${String(r[0])}`);
      // headline_weight "페어링 허용값 전체": 택소노미 전체 값을 두고 pairing이 좁힌다(allowedByPairing).
      allowed[key] =
        key === "type.headline_weight"
          ? [...(tax.get(key)?.values as string[])]
          : sortOrd(key, splitList(r[col] ?? ""));
    }
    allowed["color.palette_id"] = [0, 1, 2, 3].map((q) => `PAL-T${n}-${q}`);
    allowed["icon.set"] = [l2["icon.set"] ?? ""];
    const ordered: Record<string, string[]> = {};
    for (const k of tax.keys()) ordered[k] = allowed[k] ?? [];
    const sc = scaleRows.get(typeId) ?? [];
    const typeScale: Record<string, number[]> = {};
    scaleHead.forEach((h, j) => {
      typeScale[h] = (sc[2 + j] ?? "").split("/").map(Number);
    });
    const br = blockRows.get(typeId) ?? [];
    const pair = (c: string): string[] => splitList(c);
    const theme = m[3] ?? "";
    const item: Obj = {
      id,
      typeId,
      slug: m[1] ?? "",
      version: TAXONOMY_VERSION,
      theme: theme.startsWith("dark") ? "dark" : "light",
      base: theme.startsWith("dark") ? "dark" : theme.includes("tinted") ? "tinted-light" : "light",
      l1: cents.get(typeId) ?? [],
      l2,
      allowed: ordered,
      allowedByPairing: ["type.headline_weight"],
      palettes: allowed["color.palette_id"],
      signatureIds: splitList(m[5] ?? ""),
      defaultSignatureId: row4("기본 시그니처")[col] ?? "",
      decorCountDefault: Number.parseInt(row4("장식 효과 수(기본)")[col] ?? "0", 10),
      preferredPatterns: {
        saas: pair(br[2] ?? ""),
        local_business: pair(br[3] ?? ""),
        portfolio: pair(br[4] ?? ""),
      },
      heroVariants: pair(br[1] ?? ""),
      excludedVariants: pair(br[5] ?? ""),
      buttonPill: (row4("buttonPill")[col] ?? "") === "true",
      allowSoftRoundShadow: (m[7] ?? "") === "true",
      tokens: { typeScale, displayToBody: Number(sc[11] ?? "") },
      provenance: { method: m[6] ?? "operator", domains: [] },
    };
    return {
      path: `data/taxonomy/presets/${id}.json`,
      content: bundle(ctx, "presets", [item]),
    };
  });
}

// ---------- C03 palettes.json (03장 3.4.2 기본 + 3.4.3 대안 해석, 3.1.3 대비 재검사) ----------
const PAL_ROLES = [
  "bg",
  "surface",
  "surface-inverse",
  "fg",
  "fg-muted",
  "fg-inverse",
  "border",
  "border-strong",
  "primary",
  "on-primary",
  "primary-hover",
  "accent",
  "on-accent",
  "focus",
] as const;
type Role = (typeof PAL_ROLES)[number];
/** 3.4.3 tintHue가 바꾸는 역할(bg 유지). */
const TINT_ROLES: Role[] = [
  "surface",
  "surface-inverse",
  "fg",
  "fg-muted",
  "border",
  "border-strong",
];
/** 3.4.3 끝 문단: PAL-T{n}-0 tintHue. T2 무채, T6은 역할별 값이라 단일값 없음(ASM-011). */
const BASE_TINT_HUE: (number | null)[] = [85, null, 210, 75, 100, null, 250, 80];
/** 3.1.3 하드 대비 쌍 [앞, 뒤, 하한]. */
const CONTRAST_PAIRS: [Role, Role, number][] = [
  ["fg", "bg", 4.5],
  ["fg", "surface", 4.5],
  ["fg-muted", "bg", 4.5],
  ["fg-muted", "surface", 4.5],
  ["fg-inverse", "surface-inverse", 4.5],
  ["border-strong", "bg", 3],
  ["primary", "bg", 3],
  ["on-primary", "primary", 4.5],
  ["on-primary", "primary-hover", 4.5],
  ["on-accent", "accent", 4.5],
  ["focus", "bg", 3],
  ["focus", "surface", 3],
];

interface RoleVal {
  oklch: Oklch;
  link?: Role;
}

const hueDiff = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
const r2 = (x: number): number => Math.round(x * 100) / 100;

/** 파생 속성(3.2.2 warm·chroma 항, 3.2.1 structure·chroma). 브랜드 색 = primary·accent(ASM-011). */
function paletteAttrs(roles: Partial<Record<Role, Oklch>>): Obj {
  const brand = [roles.primary, roles.accent].filter((c): c is Oklch => c !== undefined);
  const chromatic = brand.filter((c) => c.c >= 0.04);
  const warm =
    brand.length === 0
      ? 0.5
      : 0.5 +
        0.5 *
          (brand.reduce(
            (s, c) => s + Math.cos(((c.h - 50) * Math.PI) / 180) * Math.min(1, c.c / 0.04),
            0,
          ) /
            brand.length);
  const cmax = chromatic.reduce((m, c) => Math.max(m, c.c), 0);
  const chromaScore = Math.min(1, Math.max(0, (cmax - 0.04) / 0.16));
  let structure = "mono";
  if (chromatic.length === 1) structure = "accent-on-neutral";
  if (chromatic.length >= 2) {
    const d = hueDiff(chromatic[0]?.h ?? 0, chromatic[1]?.h ?? 0);
    structure = d <= 60 ? "analogous" : d >= 165 ? "complementary" : "split-complementary";
  }
  const chroma = cmax < 0.1 ? "muted" : cmax <= 0.16 ? "medium" : "vivid";
  return {
    warm: r2(warm),
    chromaScore: r2(chromaScore),
    structure,
    chroma,
    brandColorCount: chromatic.length,
  };
}

function genPalettes(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "03_design_system.md");
  const base = table(section(md, "### 3.4.2"));
  const alts = table(section(md, "### 3.4.3"));
  const presets = table(section(md, "### 3.4.1"));
  const cell = (role: string, n: number): string =>
    base.find((r) => unquote(r[0] ?? "") === role)?.[n] ?? "—";
  const baseRoles = (n: number): Partial<Record<Role, RoleVal>> => {
    const out: Partial<Record<Role, RoleVal>> = {};
    for (const role of PAL_ROLES) {
      const c = cell(role, n).trim();
      if (c === "—") continue;
      const link = /^= ([a-z-]+)/.exec(c)?.[1] as Role | undefined;
      if (link) out[role] = { oklch: { l: 0, c: 0, h: 0 }, link };
      else out[role] = { oklch: parseOklch(/`([^`]+)`/.exec(c)?.[1] ?? "") };
    }
    return out;
  };
  const resolve = (rv: Partial<Record<Role, RoleVal>>): Partial<Record<Role, Oklch>> => {
    const out: Partial<Record<Role, Oklch>> = {};
    for (const role of PAL_ROLES) {
      const v = rv[role];
      if (!v) continue;
      out[role] = v.link ? (rv[v.link]?.oklch ?? { l: 0, c: 0, h: 0 }) : v.oklch;
    }
    return out;
  };
  const items: Obj[] = [];
  for (let n = 1; n <= 8; n++) {
    const b = baseRoles(n);
    const theme = (presets[n - 1]?.[3] ?? "").startsWith("dark") ? "dark" : "light";
    const pal0Struct = (cell("structure / chroma", n).split("/")[0] ?? "").trim();
    for (let q = 0; q <= 3; q++) {
      const id = `PAL-T${n}-${q}`;
      const roles: Partial<Record<Role, RoleVal>> = structuredClone(b);
      let tintHue = BASE_TINT_HUE[n - 1] ?? null;
      let noteKo = "";
      if (q > 0) {
        const a = alts.find((r) => r[0] === id) ?? [];
        noteKo = a[6] ?? "";
        const hueOf = (c: string): number | null =>
          c === "유지" || c === "—" || c === "" ? null : Number(c);
        const [tH, pH, aH] = [hueOf(a[1] ?? ""), hueOf(a[2] ?? ""), hueOf(a[3] ?? "")];
        const setHue = (role: Role, h: number | null): void => {
          const v = roles[role];
          if (v && !v.link && h !== null) v.oklch = fitGamut({ ...v.oklch, h });
        };
        if (tH !== null) tintHue = tH;
        for (const r of TINT_ROLES) setHue(r, tH);
        setHue("primary", pH);
        setHue("primary-hover", pH);
        setHue("accent", aH);
        // 예외 표기 행: L·C 명시값(3.4.3)
        const ex = /primary `([^`]+)`, hover `([^`]+)`/.exec(noteKo);
        if (ex) {
          roles.primary = { oklch: parseOklch(ex[1] ?? "") };
          roles["primary-hover"] = { oklch: parseOklch(ex[2] ?? "") };
        }
      }
      const res = resolve(roles);
      const hex: Partial<Record<Role, string>> = {};
      for (const [k, v] of Object.entries(res)) hex[k as Role] = oklchToHex(v);
      const out: Obj = {};
      for (const role of PAL_ROLES) {
        const v = res[role];
        const rv = roles[role];
        // 없는 역할(accent·on-accent, 3.1.3 "0~1색")은 키를 두지 않는다(ASM-031 ⑦)
        if (v)
          out[role] = {
            oklch: [v.l, Math.round(v.c * 1e4) / 1e4, v.h],
            hex: hex[role] ?? "",
            ...(rv?.link ? { link: rv.link } : {}),
          };
      }
      const ratios: Obj = {};
      const failures: string[] = [];
      for (const [f, g, min] of CONTRAST_PAIRS) {
        const hf = hex[f];
        const hg = hex[g];
        if (!hf || !hg) continue;
        const r = contrast(hf, hg);
        ratios[`${f}/${g}`] = r;
        if (r < min) failures.push(`${f}/${g} ${r} < ${min}`);
      }
      const accentTextSafe =
        hex.accent !== undefined &&
        contrast(hex.accent, hex.bg ?? "#FFFFFF") >= 4.5 &&
        contrast(hex.accent, hex.surface ?? "#FFFFFF") >= 4.5;
      const attrs = paletteAttrs(res);
      if (q === 0 && !pal0Struct.startsWith(String(attrs.structure).slice(0, 10)))
        failures.push(`structure 계산 ${String(attrs.structure)} ≠ 3.4.2 ${pal0Struct}`);
      items.push({
        id,
        typeId: `T${n}`,
        index: q,
        theme,
        tintHue,
        roles: out,
        ...attrs,
        accentTextSafe,
        contrast: ratios,
        contrastFailures: failures,
        ...(noteKo ? { noteKo } : {}),
      });
    }
  }
  return [{ path: "data/taxonomy/palettes.json", content: bundle(ctx, "palettes", items) }];
}

// ---------- B25 text-roles.json (03장 3.1.5a 표, 자간 3.8.2·행간 3.8.3) ----------
function genTextRoles(ctx: Ctx): Out[] {
  const rows = table(section(chapter(ctx.root, "03_design_system.md"), "### 3.1.5a"));
  const items: Obj[] = [];
  for (const r of rows) {
    const roles = [...(r[0] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
    const stepCell = r[1] ?? "";
    const steps = [...stepCell.matchAll(/`(t-[a-z0-9]+)`/g)].map((m) => m[1] ?? "");
    const weight = r[2] ?? "";
    const elements = (r[3] ?? "").split("·").map((x) => x.trim());
    for (const role of roles) {
      const simple = steps.length === 1 && stepCell.trim() === `\`${steps[0] ?? ""}\``;
      // 기본 단계: "그 외 …"·"md" 뒤의 단계, 없으면 첫 단계. 모바일 단계 = 데스크톱 단계(3.1.5a)
      const other = /(?:그 외|md)[^`]*`(t-[a-z0-9]+)`/.exec(stepCell)?.[1];
      const step = other ?? steps[0];
      const leading = ["button.label", "tag.label"].includes(role)
        ? "1.2"
        : steps[0] === "t-caption"
          ? "1.5"
          : weight === "heading"
            ? "heading"
            : "body";
      const tracking = role === "eyebrow" ? "label" : weight === "heading" ? "heading" : "body";
      const item: Obj = {
        id: role,
        stepDesktop: step ?? "",
        stepMobile: step ?? "",
        weight,
        leading,
        trackingClass: tracking,
        element: elements[0] ?? "",
      };
      if (elements.length > 1) item.elementsAllowed = elements;
      if (!simple) {
        item.stepVariants = steps;
        item.stepRuleKo = stepCell.replace(/`/g, "");
      }
      if (r[4]) item.noteKo = r[4];
      items.push(item);
    }
  }
  return [{ path: "data/taxonomy/text-roles.json", content: bundle(ctx, "text-roles", items) }];
}

// ---------- C03 icons/map.json (03장 3.9.1 세트·3.9.2 의미 아이콘 40개) ----------
function genIcons(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "03_design_system.md");
  const rows = table(section(md, "### 3.9.2"));
  const items: Obj[] = [];
  for (const r of rows) {
    const split = (c: string): string[] => c.split("/").map((x) => x.replace(/[†]/g, "").trim());
    const ids = split((r[0] ?? "").replace(/\(.*\)/, ""));
    const ph = split(r[1] ?? "");
    const tb = split(r[2] ?? "");
    const io = split(r[3] ?? "");
    ids.forEach((id, i) => {
      const verify = [r[1], r[2], r[3]].some((c) => (c ?? "").includes("†"));
      const noteKo = /\(([^)]*)\)/.exec(r[0] ?? "")?.[1];
      items.push({
        id,
        phosphor: ph[i] ?? ph[0] ?? "",
        tabler: tb[i] ?? tb[0] ?? "",
        iconoir: io[i] ?? io[0] ?? "",
        ...(verify ? { needsNameCheck: true } : {}),
        ...(noteKo ? { noteKo } : {}),
      });
    });
  }
  if (items.length !== 40) throw new Error(`3.9.2 의미 아이콘 ${items.length} ≠ 40`);
  return [{ path: "data/icons/map.json", content: bundle(ctx, "icons", items) }];
}

// ---------- C03 signatures.json (03장 3.2.4 장식 효과 + 시그니처 12종) ----------
const codeList = (c: string): string[] =>
  [...c.matchAll(/`([^`]+)`|\b(SIG-\d\d)\b/g)].map((m) => m[1] ?? m[2] ?? "");

function genSignatures(ctx: Ctx): Out[] {
  const sec = section(chapter(ctx.root, "03_design_system.md"), "### 3.2.4");
  const decorRows = table(sec);
  const sigSec = sec.slice(sec.indexOf("시그니처 디테일("));
  const sigRows = table(sigSec);
  const decors: Obj[] = decorRows.map((r) => ({
    id: unquote(r[0] ?? ""),
    kind: "decor",
    nameKo: r[1] ?? "",
    sourceKo: r[2] ?? "",
  }));
  const sigs: Obj[] = sigRows.map((r) => {
    const decor = unquote(r[2] ?? "");
    const reserved = (r[1] ?? "").includes("예약");
    const item: Obj = {
      id: r[0] ?? "",
      kind: "signature",
      nameKo: r[1] ?? "",
      decorId: decor === "—" ? null : decor,
      reserved,
    };
    if (!reserved) {
      item.blocksKo = r[3] ?? "";
      item.requiresKo = r[4] ?? "";
      // 충돌: SIG ID와 DecorId만 구조화, 나머지 문장은 conflictsKo에 남긴다.
      item.conflicts = codeList(r[5] ?? "").filter(
        (x) => x.startsWith("SIG-") || decorRows.some((d) => unquote(d[0] ?? "") === x),
      );
      item.conflictsKo = r[5] ?? "";
    }
    return item;
  });
  if (sigs.length !== 12) throw new Error(`3.2.4 시그니처 ${sigs.length} ≠ 12`);
  return [
    {
      path: "data/taxonomy/signatures.json",
      content: bundle(ctx, "signatures", [...decors, ...sigs]),
    },
  ];
}

// ---------- C03 harmony.json (03장 3.14 색 규칙·H1~H12·CF-01~12) ----------
/** 3.14.3 득점 규칙의 구조화(문장 원문은 ruleKo로 함께 둔다). */
const H_RULES: Record<string, Obj> = {
  H1: {
    measure: "brandColorCount",
    tiers: [
      { max: 3, points: 12 },
      { eq: 4, points: 4 },
      { min: 5, points: 0 },
    ],
  },
  H2: { measure: "colorRelationInRange", pass: 10, fail: 0 },
  H3: { measure: "chromaBalanceConditions", perCondition: 2.5, conditions: 2 },
  H4: {
    measure: "nonMonoFamilies",
    tiers: [
      { max: 2, points: 8 },
      { min: 3, points: 0 },
    ],
  },
  H5: {
    measure: "fontWeights",
    tiers: [
      { max: 3, points: 5 },
      { eq: 4, points: 2 },
      { min: 5, points: 0 },
    ],
  },
  H6: {
    measure: "typeScaleConformance",
    tiers: [
      { minRatio: 0.95, points: 10 },
      { minRatio: 0.9, points: 5 },
      { minRatio: 0, points: 0 },
    ],
    tolerancePx: 0.5,
  },
  H7: { measure: "displayToBody1280", range: [2.5, 8.0], pass: 8, fail: 0 },
  H8: {
    measure: "spacingConformance4pt",
    tiers: [
      { minRatio: 0.95, points: 10 },
      { minRatio: 0.9, points: 5 },
      { minRatio: 0, points: 0 },
    ],
  },
  H9: {
    measure: "radiusFamilyConformance",
    tiers: [
      { minRatio: 1, points: 8 },
      { minRatio: 0.95, points: 4 },
      { minRatio: 0, points: 0 },
    ],
  },
  H10: {
    measure: "conflictCount",
    tiers: [
      { max: 0, points: 10 },
      { min: 1, points: 0 },
    ],
    capOnViolation: 79,
  },
  H11: { measure: "decorOverMax", base: 6, perOver: -3, floor: 0 },
  H12: {
    measure: "rhythmViolations",
    base: 8,
    perViolation: -2,
    floor: 0,
    rules: ["LT-05", "LT-06", "LT-07", "LT-08"],
  },
};

function genHarmony(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "03_design_system.md");
  const colorRows = table(section(md, "### 3.14.1"));
  const hRows = table(section(md, "### 3.14.3"));
  const cfRows = table(section(md, "### 3.14.4"));
  const constants: Obj = {
    id: "constants",
    kind: "constants",
    brandColorMinChroma: 0.04,
    brandColorMergeDeltaE: 0.02,
    brandColorMax: 3,
    relationRanges: {
      analogous: [15, 45],
      "split-complementary": [135, 165],
      complementary: [160, 200],
    },
    achromaticPrimaryExempt: 0.04,
    accentChromaMaxRatio: 1.3,
    bgChromaMax: { light: 0.03, "tinted-light": 0.035 },
    surfaceDeltaL: [0.02, 0.06],
    accentAreaMax: 0.1,
    forbiddenHuePair: [
      [270, 310],
      [220, 260],
    ],
    displayToBody: [2.5, 8.0],
    fontWeightsMax: 3,
    nonMonoFamiliesMax: 2,
    capWithConflict: 79,
    colorRulesKo: Object.fromEntries(colorRows.map((r) => [r[0] ?? "", r[1] ?? ""])),
  };
  const hs: Obj[] = hRows.map((r) => ({
    id: r[0] ?? "",
    kind: "score",
    nameKo: r[1] ?? "",
    points: Number(r[2]),
    ruleKo: r[3] ?? "",
    rule: H_RULES[r[0] ?? ""] ?? {},
  }));
  const total = hs.reduce((a, h) => a + Number(h.points), 0);
  if (total !== 100) throw new Error(`3.14.3 배점 합 ${total} ≠ 100(AC-03-38)`);
  const cfs: Obj[] = cfRows.map((r) => ({
    id: (r[0] ?? "").replace(/\(추가\)/, ""),
    kind: "conflict",
    comboKo: r[1] ?? "",
    preventionKo: r[2] ?? "",
    ...((r[0] ?? "").includes("추가") ? { proposedByCh03: true } : {}),
  }));
  return [
    {
      path: "data/taxonomy/harmony.json",
      content: bundle(ctx, "harmony", [constants, ...hs, ...cfs]),
    },
  ];
}

// ---------- C03 components.json (03장 3.5.1 목록 + 3.5.2 state 매트릭스) ----------
/** 컴포넌트 텍스트 요소 → 3.1.5a 역할(AC-03-46 ①). 3.5.1 규칙 열·3.1.5a 비고에서 대응을 읽어 고정. */
const COMPONENT_TEXT_ROLES: Record<string, string[]> = {
  Button: ["button.label"],
  TextLink: ["body"],
  Tag: ["tag.label"],
  Input: ["form.label", "form.input", "form.help", "form.error"],
  Textarea: ["form.label", "form.input", "form.help", "form.error"],
  Select: ["form.label", "form.input", "form.help", "form.error"],
  Checkbox: ["form.label", "form.error"],
  NavBar: ["nav.wordmark", "nav.link", "button.label"],
  Drawer: ["nav.link", "button.label"],
  Footer: ["footer.wordmark", "footer.link", "footer.legal"],
  Card: ["card.title", "body"],
  MediaFrame: ["caption"],
  Avatar: ["avatar.initials"],
  PriceTag: ["pricing.price"],
  Stat: ["stat.value", "stat.label", "caption"],
  Accordion: ["accordion.question", "body"],
  Divider: [],
  Wordmark: ["nav.wordmark", "footer.wordmark"],
};

function genComponents(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "03_design_system.md");
  const list = table(section(md, "### 3.5.1")).filter((r) => /^C\d\d$/.test(r[0] ?? ""));
  const matSec = section(md, "### 3.5.2");
  const head = (matSec.split("\n").find((l) => l.startsWith("| 컴포넌트")) ?? "")
    .split("|")
    .slice(2, -1)
    .map((c) => c.trim());
  const mat = table(matSec);
  const statesFor = (name: string): Obj => {
    const row =
      mat.find((r) =>
        (r[0] ?? "")
          .split(/[(/]/)
          .map((x) => x.trim())
          .includes(name),
      ) ?? mat.find((r) => (r[0] ?? "").startsWith("기타") && (r[0] ?? "").includes(name));
    if (!row) throw new Error(`3.5.2에 ${name} 행 없음`);
    const out: Obj = {};
    head.forEach((h, i) => {
      const c = row[i + 1] ?? "—";
      if (c.includes("●") && !c.includes("placeholder"))
        out[h] = c === "●" ? true : c.replace("●", "").trim();
    });
    if ((row[head.length] ?? "").includes("placeholder 상태 ●")) out.placeholder = true;
    return out;
  };
  const items: Obj[] = list.map((r) => {
    const name = r[1] ?? "";
    return {
      id: r[0] ?? "",
      name,
      variants: (r[2] ?? "")
        .split(" / ")
        .map((v) => v.replace(/\(.*\)/, "").trim())
        .filter((v) => v.length > 0),
      sizeKo: r[3] ?? "",
      rulesKo: r[4] ?? "",
      states: statesFor(name),
      textRoles: COMPONENT_TEXT_ROLES[name] ?? [],
    };
  });
  if (items.length !== 18) throw new Error(`3.5.1 컴포넌트 ${items.length} ≠ 18`);
  return [{ path: "data/taxonomy/components.json", content: bundle(ctx, "components", items) }];
}

// ---------- C03 blocks.json (03장 3.6.1~3.6.3·3.8.1 text_cols·3.11.3 모바일, 04장 4.6.2 덱 상한) ----------
/** 3.6.2 default_heading_ko·nav_label: 03장은 예시(faq·menu·location)만 정함 → 나머지는 temp 문안(ASM-012). */
const BLOCK_META: Record<string, { nameKo: string; heading: string; nav: string | null }> = {
  nav: { nameKo: "내비게이션", heading: "", nav: null },
  hero: { nameKo: "히어로", heading: "", nav: null },
  value: { nameKo: "가치", heading: "왜 선택해야 할까요", nav: "특징" },
  feature: { nameKo: "기능", heading: "주요 기능", nav: "기능" },
  showcase: { nameKo: "쇼케이스", heading: "대표 화면", nav: null },
  stats: { nameKo: "수치", heading: "숫자로 보기", nav: null },
  process: { nameKo: "과정", heading: "이용 방법", nav: "이용 방법" },
  proof: { nameKo: "후기", heading: "고객 이야기", nav: null },
  pricing: { nameKo: "요금", heading: "요금 안내", nav: "요금" },
  faq: { nameKo: "자주 묻는 질문", heading: "자주 묻는 질문", nav: "FAQ" },
  cta: { nameKo: "행동 유도", heading: "", nav: null },
  menu: { nameKo: "메뉴", heading: "메뉴", nav: "메뉴" },
  highlight: { nameKo: "하이라이트", heading: "이곳의 특별함", nav: null },
  gallery: { nameKo: "갤러리", heading: "작업", nav: "작업" },
  location: { nameKo: "오시는 길", heading: "오시는 길", nav: "오시는 길" },
  story: { nameKo: "이야기", heading: "우리 이야기", nav: "소개" },
  about: { nameKo: "소개", heading: "소개", nav: "소개" },
  service: { nameKo: "서비스", heading: "서비스", nav: "서비스" },
  contact: { nameKo: "문의", heading: "문의하기", nav: "문의" },
  footer: { nameKo: "푸터", heading: "", nav: null },
};
/** 3.8.1 hero 6종 text_cols(T-30). */
const HERO_TEXT_COLS: Record<string, [number, number]> = {
  "full-bleed-image": [7, 4],
  "left-aligned": [8, 4],
  offset: [6, 4],
  split: [6, 4],
  "type-only": [10, 4],
  centered: [8, 4],
};
/** 3.2.4 시그니처 적용 블록(blocksKo) → variant 판정. */
function decorSlotsFor(block: string, variant: string, img: boolean, sigs: Obj[]): string[] {
  const vid = `${block}.${variant}`;
  return sigs
    .filter((g) => !g.reserved)
    .filter((g) => {
      const t = String(g.blocksKo ?? "");
      const id = String(g.id);
      if (id === "SIG-02" || id === "SIG-07" || id === "SIG-09")
        return block !== "nav" || id === "SIG-09";
      if (id === "SIG-08") return true;
      if (id === "SIG-10") return img;
      if (id === "SIG-11")
        return (
          vid === "hero.type-only" || vid === "hero.full-bleed-image" || vid === "footer.big-type"
        );
      if (id === "SIG-12")
        return vid === "hero.split" || vid === "story.split" || vid === "about.split";
      return t.split(/[,，]/).some((x) => x.trim().split(" ")[0] === block);
    })
    .map((g) => String(g.id));
}
/** 3.11.3 모바일 규칙 선택. */
function mobileRule(rows: string[][], vid: string, skeleton: string): string {
  const find = (pred: (k: string) => boolean): string | undefined =>
    rows.find((r) => pred(r[0] ?? ""))?.[1];
  const block = vid.split(".")[0] ?? "";
  const exact = find((k) =>
    k
      .split(/,\s*/)
      .map((x) => x.trim())
      .some(
        (x) =>
          x === vid ||
          x === `${block}.*` ||
          (x.includes("/") &&
            x
              .replace(/\.split$/, "")
              .split("/")
              .includes(block) &&
            vid.endsWith(".split")),
      ),
  );
  if (exact) return exact;
  if (skeleton === "split") return find((k) => k.startsWith("split(일반)")) ?? "";
  if (skeleton === "grid") return find((k) => k.startsWith("grid(일반)")) ?? "";
  return find((k) => k.startsWith("list, type")) ?? "";
}
/** 04장 4.6.2 길이 셀 → 상한. "제목 6–18, 본문 30–90" → {제목: 18, 본문: 90}, "8–24" → 24. */
function deckLimit(cell: string): number | Record<string, number> | null {
  const parts = cell.split(",").map((x) => x.trim());
  const upper = (x: string): number | null => {
    const m = /(\d+)\s*$/.exec(x.replace(/[^\d–≤ ]/g, " ").trim());
    return m ? Number(m[1]) : null;
  };
  if (parts.length > 1 || /^[가-힣]/.test(parts[0] ?? "")) {
    const o: Record<string, number> = {};
    for (const x of parts) {
      const name = /^([가-힣]+)/.exec(x)?.[1];
      const u = upper(x);
      if (name && u !== null) o[name] = u;
    }
    return Object.keys(o).length ? o : null;
  }
  return upper(parts[0] ?? "");
}

function genBlocks(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "03_design_system.md");
  const cat = table(section(md, "### 3.6.1"));
  const slotRows = new Map(table(section(md, "### 3.6.3")).map((r) => [r[0] ?? "", r]));
  const mobRows = table(section(md, "### 3.11.3"));
  const sigs = JSON.parse(genSignatures(ctx)[0]?.content ?? "{}").items.filter(
    (x: Obj) => x.kind === "signature",
  ) as Obj[];
  const deck = new Map<string, number | Record<string, number> | null>();
  for (const r of table(section(chapter(ctx.root, "04_generation.md"), "### 4.6.2"))) {
    const keys = [...(r[0] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
    const lens = (r[2] ?? "").split(" / ");
    keys.forEach((k, i) => deck.set(k, deckLimit(lens[i] ?? lens[0] ?? "")));
  }
  const blocks: Obj[] = [];
  let cur: Obj | null = null;
  let prevFb = "—";
  for (const r of cat) {
    const bname = r[0] ?? "";
    if (bname) {
      const meta = BLOCK_META[bname];
      if (!meta) throw new Error(`BLOCK_META에 ${bname} 없음`);
      cur = {
        id: bname,
        nameKo: meta.nameKo,
        default_heading_ko: meta.heading || null,
        nav_label: meta.nav,
        slots: [] as Obj[],
        variants: [] as Obj[],
      };
      blocks.push(cur);
      const sr = slotRows.get(bname);
      if (sr) {
        const names = (sr[1] ?? "")
          .split(/,\s*/)
          .map((x) => x.trim())
          .filter(Boolean);
        const deckKeys = (sr[2] ?? "")
          .split(/,\s*/)
          .map((x) => /([a-z]+\.(?:[a-z]+|\*)(?:\[\d\])?)/.exec(x)?.[1] ?? "")
          .filter(Boolean);
        const nonMedia = names.filter(
          (n) => !n.startsWith("media") && !n.startsWith("mapPlaceholder"),
        );
        (cur.slots as Obj[]).push(
          ...names.map((raw) => {
            const id = raw
              .replace(/[●]/g, "")
              .replace(/\(.*\)/, "")
              .replace(/×n/, "")
              .trim();
            const kind = /^media|mapPlaceholder/.test(id)
              ? "image"
              : /Cta$|^links$/.test(id)
                ? "link"
                : /^(items|plans|groups|captions)$/.test(id)
                  ? "list"
                  : "copy";
            const idx = nonMedia.indexOf(raw);
            const keys =
              kind === "image"
                ? []
                : nonMedia.length === deckKeys.length && idx >= 0
                  ? [deckKeys[idx] ?? ""]
                  : deckKeys;
            const slot: Obj = { id, kind, deckKeys: keys, required: raw.includes("●") };
            const lim = keys.length === 1 ? deck.get(keys[0] ?? "") : undefined;
            if (lim !== undefined && lim !== null) slot.maxLength = lim;
            if (kind === "list" && sr[3] && sr[3] !== "—") slot.listRangeKo = sr[3];
            return slot;
          }),
        );
      }
    }
    if (!cur) continue;
    const vs = (r[1] ?? "").split(" / ").map((x) => x.trim());
    const aligns = (r[2] ?? "").split(" / ").map((x) => x.trim());
    vs.forEach((v, i) => {
      const id = `${String(cur?.id)}.${v}`;
      const skeleton = r[3] === "—" ? null : (r[3] ?? null);
      const imgCell = r[4] ?? "0";
      const hasImg = imgCell !== "0";
      const ratios = [...imgCell.matchAll(/\b(1:1|4:5|3:2|16:9|21:9)\b/g)].map((m) => m[1] ?? "");
      const metaCell = r[5] ?? "";
      const fb = (r[6] ?? "—") === "〃" ? prevFb : (r[6] ?? "—");
      prevFb = fb;
      const fbVariant = /^[a-z-]+$/.test(fb)
        ? `${String(cur?.id)}.${fb}`
        : fb.startsWith("value.")
          ? fb
          : null;
      const textOverImage = metaCell.includes("text_over_image");
      const allowedBg =
        id === "cta.band"
          ? ["inverse"]
          : textOverImage
            ? ["image"]
            : String(cur?.id) === "hero"
              ? ["bg", "surface"]
              : ["bg", "surface", "inverse"];
      const vdef: Obj = {
        id,
        align: aligns[i] ?? aligns[0] ?? "",
        skeleton,
        image: hasImg ? { countKo: imgCell, ratios: [...new Set(ratios)] } : null,
        icon_grid: metaCell.includes("icon_grid"),
        text_over_image: textOverImage,
        fallback_variant: fbVariant,
        allowed_bg: allowedBg,
        decor_slots: decorSlotsFor(String(cur?.id), v, hasImg, sigs),
        mobile: skeleton ? mobileRule(mobRows, id, skeleton) : "",
      };
      if (fb !== "—" && !fbVariant) vdef.fallbackKo = fb;
      if (metaCell) vdef.metaKo = metaCell;
      const tc = String(cur?.id) === "hero" ? HERO_TEXT_COLS[v] : undefined;
      if (tc) vdef.text_cols = { lg: tc[0], base: tc[1] };
      (cur?.variants as Obj[]).push(vdef);
    });
  }
  // "50 variant" = nav(컴파일러 생성) 3개를 뺀 수(표 합계 53, ASM-012)
  const nVar = blocks
    .filter((b) => b.id !== "nav")
    .reduce((a, b) => a + (b.variants as Obj[]).length, 0);
  if (blocks.length !== 20 || nVar !== 50)
    throw new Error(`3.6.1 블록 ${blocks.length}/20, variant ${nVar}/50`);
  return [{ path: "data/taxonomy/blocks.json", content: bundle(ctx, "blocks", blocks) }];
}

// ---------- C03 tokens/schema.json (03장 3.1.2 DTCG TokenSet JSON Schema 2020-12) ----------
/** 3.1.2 최상위 그룹(필수, 그 밖은 위반). */
const TOKEN_GROUPS = [
  "color",
  "font",
  "type",
  "space",
  "radius",
  "border",
  "shadow",
  "motion",
  "layout",
  "media",
  "z",
  "opacity",
];
/** 3.1.2 사용 $type. */
const TOKEN_TYPES = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "number",
  "duration",
  "cubicBezier",
  "shadow",
  "typography",
  "border",
];
/** 3.1.3 색 역할 중 팔레트·파생으로 항상 생기는 것(accent·on-accent는 선택). */
const REQUIRED_COLOR_ROLES = [
  "bg",
  "surface",
  "surface-inverse",
  "fg",
  "fg-muted",
  "fg-inverse",
  "border",
  "border-strong",
  "primary",
  "on-primary",
  "primary-hover",
  "primary-active",
  "focus",
  "focus-inverse",
  "success",
  "warning",
  "danger",
  "neutral",
  "overlay",
];

function genTokenSchema(ctx: Ctx): Out[] {
  const alias = { type: "string", pattern: "^\\{[a-z0-9.-]+\\}$" };
  const value = (v: Obj): Obj => ({ anyOf: [v, { $ref: "#/$defs/alias" }] });
  const dim = (units: string[]): Obj => ({
    type: "object",
    required: ["value", "unit"],
    additionalProperties: false,
    properties: { value: { type: "number" }, unit: { enum: units } },
  });
  const valueSchemas: Record<string, Obj> = {
    color: { $ref: "#/$defs/colorValue" },
    dimension: dim(["px", "rem", "em"]),
    fontFamily: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
    fontWeight: { type: "integer", minimum: 100, maximum: 900 },
    number: { type: "number" },
    duration: dim(["ms"]),
    cubicBezier: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 },
    shadow: {
      anyOf: [
        { $ref: "#/$defs/shadowLayer" },
        { type: "array", items: { $ref: "#/$defs/shadowLayer" } },
      ],
    },
    typography: { type: "object" },
    border: { type: "object" },
  };
  const defs: Obj = {
    alias,
    extensions: {
      type: "object",
      properties: {
        "app.tastefit": {
          type: "object",
          properties: {
            source: { enum: ["preset", "palette", "formula", "brand"] },
            l2Key: { type: "string" },
            contrast: {
              type: "object",
              properties: { against: { type: "string" }, ratio: { type: "number" } },
            },
          },
        },
      },
    },
    colorValue: {
      type: "object",
      required: ["colorSpace", "components", "hex"],
      additionalProperties: false,
      properties: {
        colorSpace: { const: "oklch" },
        components: {
          type: "array",
          prefixItems: [
            { type: "number", minimum: 0, maximum: 1 },
            { type: "number", minimum: 0, maximum: 0.37 },
            { type: "number", minimum: 0, maximum: 360 },
          ],
          minItems: 3,
          maxItems: 3,
        },
        alpha: { type: "number", minimum: 0, maximum: 1 },
        hex: { type: "string", pattern: "^#[0-9A-F]{6}$" },
      },
    },
    shadowLayer: {
      type: "object",
      required: ["color", "offsetX", "offsetY", "blur", "spread"],
      properties: {
        color: value({ $ref: "#/$defs/colorValue" }),
        offsetX: dim(["px"]),
        offsetY: dim(["px"]),
        blur: dim(["px"]),
        spread: dim(["px"]),
        inset: { type: "boolean" },
      },
    },
    token: { oneOf: TOKEN_TYPES.map((t) => ({ $ref: `#/$defs/${t}Token` })) },
    group: {
      type: "object",
      propertyNames: { pattern: "^(\\$description|[a-z0-9-]+)$" },
      additionalProperties: {
        anyOf: [{ $ref: "#/$defs/token" }, { $ref: "#/$defs/group" }],
      },
      not: { required: ["$value"] },
    },
  };
  for (const t of TOKEN_TYPES)
    defs[`${t}Token`] = {
      type: "object",
      required: ["$type", "$value"],
      additionalProperties: false,
      properties: {
        $type: { const: t },
        $value: value(valueSchemas[t] ?? {}),
        $description: { type: "string" },
        $extensions: { $ref: "#/$defs/extensions" },
      },
    };
  const props: Obj = { $schemaVersion: { const: "tokens-1" } };
  for (const g of TOKEN_GROUPS) props[g] = { $ref: "#/$defs/group" };
  props.color = {
    allOf: [{ $ref: "#/$defs/group" }, { required: REQUIRED_COLOR_ROLES }],
  };
  const schema: Obj = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://tastefit.local/schema/tokens-1.json",
    type: "object",
    required: ["$schemaVersion", ...TOKEN_GROUPS],
    additionalProperties: false,
    properties: props,
    $defs: defs,
  };
  return [
    {
      path: "data/tokens/schema.json",
      content: bundle(ctx, "token-schema", [{ id: "tokens-1", schema }]),
    },
  ];
}

// ---------- B6 fonts/registry.json (03장 3.7.2) · B7 fonts/pairings.json (03장 3.7.3) ----------
// id는 tmp_ 접두(ASM-008 자유 id 묶음). 페어링의 장 ID(FP01~)는 `code`에 두고 프리셋 l2는 code를 쓴다(ASM-013).
// 폰트 원본 파일은 사람 묶음(HUMAN_TODO B6)이라 temp에는 `files: []`(filesPending).
const fontSourceUrl = (src: string, family: string): string => {
  if (src.startsWith("github.com")) return `https://${src}`;
  if (src === "fonts.google.com")
    return `https://fonts.google.com/specimen/${family.replace(/ /g, "+")}`;
  return `https://${src}/`;
};
const familyOf = (cell: string): string => cell.replace(/\(.*\)$/, "").trim();

function fontRows(root: string): string[][] {
  return table(section(chapter(root, "03_design_system.md"), "### 3.7.2"));
}

function genFonts(ctx: Ctx): Out[] {
  const items: Obj[] = fontRows(ctx.root).map((r) => {
    const family = familyOf(r[1] ?? "");
    const src = fontSourceUrl(r[5] ?? "", family);
    const item: Obj = {
      id: `tmp_${r[0] ?? ""}`,
      code: r[0] ?? "",
      family,
      script: r[2] ?? "",
      classification: r[3] ?? "",
      buildWeights: (r[4] ?? "").split(",").map((w) => Number(w.trim())),
      license: "OFL-1.1",
      licenseUrl: src,
      sourceUrl: src,
      files: [],
      filesPending: true,
      reservedFontName: false,
      verified_by: "temp-agent", // 9.2.4 S-10
      verified_at: null,
      subsetFamily: `tf-${r[0] ?? ""}`,
    };
    if (r[6]) item.noteKo = r[6];
    return item;
  });
  return [{ path: "data/fonts/registry.json", content: bundle(ctx, "fonts", items) }];
}

function genPairings(ctx: Ctx): Out[] {
  const fonts = fontRows(ctx.root).map((r) => ({
    id: `tmp_${r[0] ?? ""}`,
    family: familyOf(r[1] ?? ""),
    cls: r[3] ?? "",
  }));
  const fontByName = (name: string): { id: string; cls: string } => {
    const f = fonts.find((x) => name.startsWith(x.family));
    if (!f) throw new Error(`3.7.3 서체 ${name} 없음`);
    return f;
  };
  const rows = table(section(chapter(ctx.root, "03_design_system.md"), "### 3.7.3"));
  const items: Obj[] = rows.map((r) => {
    const headCell = (r[2] ?? "").replace(/\([^)]*\)/g, "");
    const head = fontByName(headCell);
    const weights = [...headCell.matchAll(/(\*\*)?(\d{3})(\*\*)?/g)].map((m) => ({
      w: m[2] ?? "",
      def: m[1] === "**",
    }));
    const latin = (r[3] ?? "") === "—" ? null : fontByName(familyOf(r[3] ?? ""));
    const adj = /\((\d+)%\)/.exec(r[3] ?? "")?.[1];
    const body = fontByName((r[4] ?? "").replace(/\(.*\)/, "").trim());
    const mono = (r[5] ?? "") === "—" ? null : fontByName(r[5] ?? "");
    const [temp, expr, soft] = (r[7] ?? "").split(/\s+/).map(Number);
    const item: Obj = {
      id: `tmp_${r[0] ?? ""}`,
      code: r[0] ?? "",
      nameKo: r[1] ?? "",
      headingFontId: head.id,
      bodyFontId: body.id,
      headlineWeights: weights.map((x) => x.w),
      defaultHeadlineWeight: weights.find((x) => x.def)?.w ?? weights[0]?.w ?? "",
      emphasisWeight: Number(/(\d{3})/.exec(r[6] ?? "")?.[1] ?? "700"),
      sig: { temp: temp ?? 0, expr: expr ?? 0, soft: soft ?? 0 },
      contrastSerif: (r[8] ?? "") === "Y",
      allowedTypes: (r[9] ?? "").split(",").map((t) => t.trim()),
      classHeading: head.cls,
      classBody: body.cls,
      tags: [...new Set([head.cls, body.cls, ...(mono ? ["mono"] : [])])],
    };
    if (latin) {
      item.headingLatinFontId = latin.id;
      item.latinSizeAdjust = Number(adj ?? "100") / 100;
    }
    if (mono) item.labelFontId = mono.id;
    if ((r[2] ?? "").includes("≥ 48px")) item.weightNotesKo = "300은 ≥ 48px 단계만";
    return item;
  });
  return [{ path: "data/fonts/pairings.json", content: bundle(ctx, "pairings", items) }];
}

// ---------- B8 images/manifest.json (03장 3.10.2·3.10.3) + 플레이스홀더 SVG ----------
// 사진 원본은 사람 묶음(HUMAN_TODO B8). temp는 에이전트가 만든 무늬 SVG(source placeholder, LicenseRef-TasteFit-Generated)를 파일로 두고
// sha256을 실제 파일에서 계산한다. id는 `tmp_img:<tag>-<nnn>`(3.10.3 형식 + tmp_ 접두, ASM-008).
const TONE_HEX: Record<string, [number, number, number]> = {
  "tone.warm": [200, 162, 122],
  "tone.neutral": [184, 184, 180],
  "tone.cool": [143, 166, 184],
};

function placeholderSvg(w: number, h: number, fill: string, tag: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${tag} 이미지 자리">` +
    `<defs><pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="48" stroke="#000" stroke-opacity="0.12" stroke-width="4"/></pattern></defs>` +
    `<rect width="100%" height="100%" fill="${fill}"/><rect width="100%" height="100%" fill="url(#p)"/></svg>\n`
  );
}

function genImages(ctx: Ctx): Out[] {
  const rows = table(section(chapter(ctx.root, "03_design_system.md"), "### 3.10.2"));
  const out: Out[] = [];
  const items: Obj[] = [];
  const hex2 = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  for (const r of rows) {
    const tagCell = r[0] ?? "";
    const counts = (r[1] ?? "").split("/").map((x) => Number(x.trim()));
    // "common.texture-paper / -concrete / -fabric" 펼치기
    const base = tagCell.split(" / ")[0] ?? "";
    const prefix = base.slice(0, base.lastIndexOf("-"));
    const tags = tagCell.split(" / ").map((t) => (t.startsWith("-") ? `${prefix}${t}` : t.trim()));
    const scene = (r[2] ?? "").replace(/\(.*\)/, "").trim();
    tags.forEach((tag, ti) => {
      const n = counts[ti] ?? 0;
      const texture = tag.startsWith("common.texture");
      for (let i = 0; i < n; i++) {
        const tone = texture
          ? "tone.neutral"
          : (["tone.warm", "tone.neutral", "tone.cool"][i % 3] ?? "");
        const landscape = texture || i % 2 === 0; // 3.10.2 landscape ≥ 40%·portrait ≥ 30%
        const [w, h] = landscape ? [2400, 1600] : [1600, 2000];
        const [cr, cg, cb] = TONE_HEX[tone] ?? [180, 180, 180];
        const j = (): number => (ctx.rand() - 0.5) * 24;
        const fill = `#${hex2(cr + j())}${hex2(cg + j())}${hex2(cb + j())}`;
        const nnn = String(i + 1).padStart(3, "0");
        const path = `data/images/placeholder/${tag}-${nnn}.svg`;
        const svg = placeholderSvg(w, h, fill, tag);
        out.push({ path, content: svg });
        const fp = (): number => Math.round((0.35 + ctx.rand() * 0.3) * 100) / 100;
        items.push({
          id: `tmp_img:${tag}-${nnn}`,
          path,
          sha256: createHash("sha256").update(svg).digest("hex"),
          width: w,
          height: h,
          tags: [tag, tone, landscape ? "orient.landscape" : "orient.portrait"],
          focalPoint: [fp(), fp()],
          dominantColor: fill,
          altKo: `${scene} 장면 임시 자리 ${i + 1}번`,
          source: "placeholder",
          author: "seed:temp",
          license: "LicenseRef-TasteFit-Generated", // 9.2.4 S-10
          verified_by: "temp-agent",
          verified_at: null,
          downloadedAt: null,
          hasPeople: false,
          hasRecognizableFace: false,
          hasLogoOrTrademark: false,
        });
      }
    });
  }
  if (items.length !== 192) throw new Error(`3.10.2 이미지 ${items.length} ≠ 192`);
  out.push({ path: "data/images/manifest.json", content: bundle(ctx, "images", items) });
  return out;
}

// ---------- B9 survey/templates.json (02장 2.4.3) ----------
/** 2.4.3 이미지 규칙(무채 C ≤ 0.04): temp는 neutral 톤 플레이스홀더에서 고정 선택(3.10.2 순환상 002·005·008이 neutral). */
const TEMPLATE_IMAGES: Record<string, string[]> = {
  "tpl-hero": ["tmp_img:portfolio.still-life-002"],
  "tpl-grid": [
    "tmp_img:portfolio.still-life-005",
    "tmp_img:portfolio.tools-002",
    "tmp_img:saas.material-002",
  ],
  "tpl-text": ["tmp_img:portfolio.interior-002"],
};

function genTemplates(ctx: Ctx): Out[] {
  const sec = section(chapter(ctx.root, "02_diagnosis.md"), "### 2.4.3");
  // 고정 텍스트 셀은 " · "로 나뉜 "라벨 \"문구\"…" 조각. 같은 라벨의 nth 조각의 따옴표 문구들.
  const segs = table(sec)
    .map((r) => r[2] ?? "")
    .join(" · ")
    .split(" · ");
  const q = (label: string, nth = 0): string[] => {
    const seg =
      segs.filter((x) => x.startsWith(`${label} `) || x.includes(` ${label} "`))[nth] ?? "";
    const sub = seg.slice(Math.max(0, seg.indexOf(`${label} `)));
    return [...sub.matchAll(/"([^"]*)"/g)].map((x) => x[1] ?? "");
  };
  const [headline = ""] = q("헤드라인");
  const [body = ""] = q("본문");
  const cards = q("카드");
  const copy: Record<string, string> = {
    "nav.logo": q("로고")[0] ?? "한결",
    "nav.menu": q("메뉴")[0] ?? "",
    "nav.cta": q("버튼")[0] ?? "",
    "hero.headline": headline.replace(" / ", "\n"),
    "hero.sub": body,
    "hero.primaryCta": q("버튼", 1)[0] ?? "",
    "hero.secondaryCta": q("버튼", 1)[1] ?? "",
    "grid.title": q("제목")[0] ?? "",
    "grid.desc": q("설명")[0] ?? "",
    "grid.item": "기본 01~기본 06",
    "grid.itemSub": q("보조")[0] ?? "",
    "grid.cta": "모두 보기",
    "text.quote": q("인용")[0] ?? "",
    "text.body":
      "[임시] 오래 쓰는 물건은 처음보다 나중에 더 좋아집니다. 손에 익을수록 편해지는 것을 만듭니다.",
    "text.stats": q("숫자")[0] ?? "",
    "text.statLabels": q("라벨")[0] ?? "",
    "text.signature": q("서명")[0] ?? "",
  };
  cards.forEach((c, i) => {
    copy[`hero.card${i + 1}`] = c;
  });
  const sections = (id: string): Obj[] => {
    if (id === "tpl-hero")
      return [
        {
          id: "s1",
          block: "nav",
          variant: "split",
          slots: { wordmark: "nav.logo", links: "nav.menu", cta: "nav.cta" },
        },
        {
          id: "s2",
          block: "hero",
          variant: "split",
          slots: {
            headline: "hero.headline",
            sub: "hero.sub",
            primaryCta: "hero.primaryCta",
            secondaryCta: "hero.secondaryCta",
            media: 0,
          },
        },
        {
          id: "s3",
          block: "value",
          variant: "numbered",
          slots: { items: ["hero.card1", "hero.card2", "hero.card3"] },
        },
      ];
    if (id === "tpl-grid")
      return [
        {
          id: "s1",
          block: "gallery",
          variant: "grid",
          slots: {
            title: "grid.title",
            desc: "grid.desc",
            items: "grid.item",
            itemSub: "grid.itemSub",
            media: [0, 1, 2, 0, 1, 2],
          },
        },
        { id: "s2", block: "cta", variant: "band", slots: { primaryCta: "grid.cta" } },
      ];
    return [
      { id: "s1", block: "proof", variant: "quote-large", slots: { quote: "text.quote" } },
      { id: "s2", block: "story", variant: "text", slots: { body: "text.body", media: 0 } },
      {
        id: "s3",
        block: "stats",
        variant: "row",
        slots: { items: "text.stats", labels: "text.statLabels", signature: "text.signature" },
      },
    ];
  };
  const item: Obj = {
    id: "survey-templates",
    demoBrand: { name: copy["nav.logo"] ?? "한결", tagline: body, copy },
    templates: ["tpl-hero", "tpl-grid", "tpl-text"].map((id) => ({
      id,
      page: { viewport: [1280, 800], sections: sections(id) },
      imageIds: TEMPLATE_IMAGES[id] ?? [],
    })),
  };
  return [{ path: "data/survey/templates.json", content: bundle(ctx, "survey-templates", [item]) }];
}

// ---------- B10 survey/card_plan.json (02장 2.4.2·2.4.6) ----------
/** 2.4.6 축 서술 고정 사전(5축 × 표시 구간 L0~L4). 02장은 예시 1개만 있어 2.1.2 앵커 문구로 temp 작성(ASM-016). */
const AXIS_PHRASES: Record<string, string[]> = {
  A1: [
    "장식 없이 무채색 위주인",
    "포인트 색 하나만 쓴",
    "포인트 색이 1~2개인",
    "색과 크기 대비가 큰",
    "색과 장식이 많고 크기 대비가 아주 큰",
  ],
  A2: [
    "푸른 계열이 주조인",
    "회색 바탕에 푸른 포인트인",
    "중성색 바탕인",
    "아이보리 바탕에 주황 포인트인",
    "크림 바탕에 붉은 계열이 주조인",
  ],
  A3: [
    "모서리가 직각인",
    "모서리가 살짝 둥근",
    "모서리가 둥근",
    "모서리가 많이 둥근",
    "모서리가 아주 둥근",
  ],
  A4: ["여백이 아주 넓은", "여백이 넓은", "여백이 보통인", "정보가 촘촘한", "정보가 아주 촘촘한"],
  A5: [
    "그림자 없이 평평한",
    "구분선 위주로 평평한",
    "카드에 옅은 그림자가 있는",
    "그림자가 겹겹이 있는",
    "반투명·오프셋 효과로 입체적인",
  ],
};
const TEMPLATE_DESC: Record<string, string> = {
  "tpl-hero": "첫 화면 히어로 구성",
  "tpl-grid": "6칸 그리드 구성",
  "tpl-text": "인용문과 숫자 구성",
};
const level = (x: number): number => Math.min(4, Math.floor(x / 0.2));

export function standardVectors(root: string): { id: string; baseTypeId: string; l1: number[] }[] {
  const cents = specCentroids(root);
  const anchors = [...cents.entries()].map(([t, v], i) => ({
    id: `SV${String(i + 1).padStart(2, "0")}`,
    baseTypeId: t,
    l1: v,
  }));
  const bridges = table(section(chapter(root, "02_diagnosis.md"), "### 2.4.2"))
    .filter((r) => /^SV(09|1[0-6])$/.test(r[0] ?? ""))
    .map((r) => ({ id: r[0] ?? "", baseTypeId: r[2] ?? "", l1: r.slice(3, 8).map(Number) }));
  return [...anchors, ...bridges];
}

export function mapData(ctx: Ctx): { data: MapData; presets: Map<string, PresetLite> } {
  const items = (o: Out): Obj[] => (JSON.parse(o.content) as { items: Obj[] }).items;
  const data = {
    taxonomy: items(genTaxonomy(ctx)[0] as Out),
    mapping: items(genMapping(ctx)[0] as Out),
    pairings: items(genPairings(ctx)[0] as Out),
    palettes: items(genPalettes(ctx)[0] as Out),
  } as unknown as MapData;
  const presets = new Map(
    genPresets(ctx).map((o) => {
      const p = items(o)[0] as unknown as PresetLite;
      return [p.typeId, p];
    }),
  );
  return { data, presets };
}

function genCardPlan(ctx: Ctx): Out[] {
  const { data, presets } = mapData(ctx);
  const items: Obj[] = [];
  for (const sv of standardVectors(ctx.root)) {
    const p = presets.get(sv.baseTypeId);
    if (!p) throw new Error(`기준 유형 ${sv.baseTypeId} 프리셋 없음`);
    const l2 = mapL1toL2(sv.l1 as unknown as L1, p, data);
    const overrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(l2)) if (p.l2[k] !== v) overrides[k] = v;
    // 축 서술 3개: 0.5에서 먼 축 순(동률은 축 순서)
    const axes = sv.l1
      .map((v, i) => ({ i, d: Math.abs(v - 0.5), v }))
      .sort((a, b) => b.d - a.d || a.i - b.i)
      .slice(0, 3)
      .sort((a, b) => a.i - b.i);
    const phrase = axes.map((a) => AXIS_PHRASES[`A${a.i + 1}`]?.[level(a.v)] ?? "").join(", ");
    for (const tpl of ["hero", "grid", "text"]) {
      const templateId = `tpl-${tpl}`;
      items.push({
        id: `C-${sv.id}-${tpl}`,
        svId: sv.id,
        kind: Number(sv.id.slice(2)) <= 8 ? "anchor" : "bridge",
        presetId: p.id,
        templateId,
        targetL1: sv.l1,
        l2Overrides: overrides,
        altKo: `선택지 {n}: ${TEMPLATE_DESC[templateId] ?? ""}, ${phrase}`,
        status: "draft",
      });
    }
  }
  return [{ path: "data/survey/card_plan.json", content: bundle(ctx, "card-plan", items) }];
}

// ---------- B11 survey/ab_plan.json (02장 2.4.4, ID 2.3.6) ----------
/** 2.4.4 focus_region(축별 고정). */
const FOCUS_REGION: Record<string, number[]> = {
  A1: [0, 0.08, 1, 0.62],
  A2: [0, 0, 1, 1],
  A3: [0, 0.45, 1, 0.55],
  A4: [0, 0, 1, 1],
  A5: [0, 0.55, 1, 0.45],
};
const AB_LEVELS = [0.2, 0.5, 0.8];
const AB_PAIRS: [number, number][] = [
  [0.2, 0.5],
  [0.5, 0.8],
  [0.2, 0.8],
];

function genAbPlan(ctx: Ctx): Out[] {
  const { data, presets } = mapData(ctx);
  const items: Obj[] = [];
  for (let n = 1; n <= 8; n++) {
    const p = presets.get(`T${n}`);
    if (!p) throw new Error(`PS-T${n} 없음`);
    for (let a = 0; a < 5; a++) {
      const axis = `A${a + 1}`;
      const image = (lv: number): Obj => {
        const t = p.l1.map((v, i) => (i === a ? lv : v));
        const l2 = mapL1toL2(t as unknown as L1, p, data);
        const overrides: Record<string, string> = {};
        for (const [k, v] of Object.entries(l2)) if (p.l2[k] !== v) overrides[k] = v;
        return {
          id: `AB-T${n}-${axis}-${Math.round(lv * 100)}`,
          targetL1: t,
          l2Overrides: overrides,
        };
      };
      const imgs = new Map(AB_LEVELS.map((lv) => [lv, image(lv)]));
      for (const [la, lb] of AB_PAIRS) {
        const A = imgs.get(la) as Obj;
        const B = imgs.get(lb) as Obj;
        items.push({
          id: `ABP-T${n}-${axis}-${Math.round(la * 100)}${Math.round(lb * 100)}`,
          axis,
          basePresetId: p.id,
          levelA: la,
          levelB: lb,
          templateId: "tpl-hero",
          pairImageIds: [A.id, B.id],
          images: [A, B],
          focusRegion: FOCUS_REGION[axis] ?? [0, 0, 1, 1],
          promptKo: "어느 쪽이 더 마음에 드나요?",
          status: "draft",
        });
      }
    }
  }
  return [{ path: "data/survey/ab_plan.json", content: bundle(ctx, "ab-plan", items) }];
}

// ---------- B12 survey/approvals.json (09장 9.2.4 B12) ----------
// 자동 게이트(렌더·린터·추출 L1 오차)는 M4 survey:build가 돌린다. temp 시점에는 게이트 미실행이므로 전부 rejected + 사유.
function genApprovals(ctx: Ctx): Out[] {
  const ids = [genCardPlan(ctx), genAbPlan(ctx)].flatMap((o) =>
    ((JSON.parse(o[0]?.content ?? "{}") as { items: Obj[] }).items ?? []).map((x) => String(x.id)),
  );
  const items: Obj[] = ids.map((assetId) => ({
    id: `apv:${assetId}`,
    assetId,
    decision: "rejected",
    reason: "temp: 자동 게이트(하드 게이트·린터·추출 L1 오차) 미실행 — M4 survey:build에서 재판정",
    reviewedAt: PREPARED_AT,
    reviewedBy: "temp-agent",
  }));
  return [{ path: "data/survey/approvals.json", content: bundle(ctx, "approvals", items) }];
}

// ---------- B13 references/seed.json (09장 9.2.4 B13, 쿼터 05장 5.2.2) ----------
function genReferences(ctx: Ctx): Out[] {
  const cents = [...specCentroids(ctx.root).entries()];
  const purposes = ["saas", "portfolio", "local_business"];
  const tiers = ["T1", "T2", "T3"];
  const items: Obj[] = [];
  for (let i = 0; i < 60; i++) {
    // 유형당 7~8개: T1~T4 8개, T5~T8 7개 (32 + 28 = 60)
    const ti = i < 32 ? Math.floor(i / 8) : 4 + Math.floor((i - 32) / 7);
    const [typeId, c] = cents[ti] ?? ["T1", [0.5, 0.5, 0.5, 0.5, 0.5]];
    const l1 = c.map(
      (v) => Math.round(Math.min(1, Math.max(0, v + (ctx.rand() * 0.3 - 0.15))) * 100) / 100,
    );
    const nn = String(i + 1).padStart(2, "0");
    items.push({
      id: `tmp_ref_${nn}`,
      url: `https://tmp-ref-${nn}.invalid/`,
      domain: `tmp-ref-${nn}.invalid`,
      titleKo: `[임시] 레퍼런스 ${nn}`,
      typeId,
      l1,
      tier: tiers[i % 3],
      purpose: purposes[Math.floor(i / 3) % 3],
      styleTags: [],
      badgeKo: "[임시]",
      robotsCheckedAt: "temp:not-checked",
      termsCheckedAt: "temp:not-checked",
      optOut: false,
    });
  }
  return [{ path: "data/references/seed.json", content: bundle(ctx, "references", items) }];
}

// ---------- B16 golden/GS-NN.json (07장 7.2.2 스키마·7.2.3 구성표 32행 골격, muRef·answers null(T-04)) ----------
const AXIS_KEY_BY_NAME = ["expression", "temperature", "shape", "density", "depth"];
const DEFAULT_ACTION_DESC: Record<string, string> = {
  saas: "업무를 더 빠르게 끝내도록 돕는 서비스입니다",
  portfolio: "작업과 경력을 한곳에 모아 소개하는 페이지입니다",
  local_business: "동네에서 매일 문을 여는 작은 가게입니다",
};

/** grapheme 기준 정확히 n자(끝 공백은 마침표로 바꿔 trim 손실 없음). */
function fitLen(text: string, n: number): string {
  const seg = [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text)].map(
    (x) => x.segment,
  );
  const out = seg.slice(0, n);
  if (out[out.length - 1] === " ") out[out.length - 1] = ".";
  if (out.length < n) throw new Error(`fitLen: ${text} < ${n}`);
  return out.join("");
}

function genGolden(ctx: Ctx): Out[] {
  const rows = table(section(chapter(ctx.root, "07_quality.md"), "### 7.2.3"));
  const edgeRows = new Map(
    table(
      section(chapter(ctx.root, "07_quality.md"), "### 7.2.3").split("엣지 케이스 기대 결과")[1] ??
        "",
    ).map((r) => [r[0] ?? "", r[1] ?? ""]),
  );
  const cents = specCentroids(ctx.root);
  const clipG = (x: number): number => Math.round(Math.min(0.95, Math.max(0.05, x)) * 100) / 100;
  const nearest = (v: number[]): string =>
    [...cents.entries()]
      .map(([t, c]) => ({ t, d: Math.hypot(...c.map((x, i) => x - (v[i] ?? 0))) }))
      .sort((a, b) => a.d - b.d || (a.t < b.t ? -1 : 1))[0]?.t ?? "T1";
  const pairs = [...cents.entries()].flatMap(([a, ca], i) =>
    [...cents.entries()]
      .slice(i + 1)
      .map(([b, cb]) => ({ a, b, d: Math.hypot(...ca.map((x, k) => x - (cb[k] ?? 0))), ca, cb })),
  );
  const far = [...pairs].sort((x, y) => y.d - x.d)[0];
  const close = [...pairs].sort((x, y) => x.d - y.d)[0];
  const mid = (p: typeof far): number[] =>
    p
      ? p.ca.map((x, k) => Math.round(((x + (p.cb[k] ?? 0)) / 2) * 100) / 100)
      : [0.5, 0.5, 0.5, 0.5, 0.5];
  const theta = new Map<string, number[]>();
  const out: Out[] = [];
  for (const r of rows) {
    const id = r[0] ?? "";
    if (!/^GS-\d\d$/.test(id)) continue;
    const num = Number(id.slice(3));
    const kind = r[1] ?? "";
    const typeCell = r[2] ?? "";
    const purpose = r[3] ?? "";
    const off = r[4] ?? "";
    let th: number[];
    let policy = "argmax";
    const flags: string[] = [];
    const same = /^GS-\d\d와 동일$|^GS-\d\d과 동일$/.test(off) ? off.slice(0, 5) : null;
    if (same) th = theta.get(same) ?? [0.5, 0.5, 0.5, 0.5, 0.5];
    else if (/^T[1-8]$/.test(typeCell)) {
      const c = [...(cents.get(typeCell) ?? [])];
      for (const m of off.matchAll(/([a-z]+) ([+−-])0\.05/g)) {
        const k = AXIS_KEY_BY_NAME.indexOf(m[1] ?? "");
        if (k >= 0) c[k] = (c[k] ?? 0) + (m[2] === "+" ? 0.05 : -0.05);
      }
      th = c.map(clipG);
    } else if (off.includes("전 축 1.0")) th = [1, 1, 1, 1, 1];
    else if (off.includes("전 축 0.0")) th = [0, 0, 0, 0, 0];
    else if (typeCell === "상충") {
      th = mid(far);
      policy = `alternate:${far?.a ?? ""},${far?.b ?? ""}`;
      flags.push("conflict");
    } else if (typeCell === "동률") {
      th = mid(close);
      flags.push("tie");
    } else {
      th = [0.5, 0.5, 0.5, 0.5, 0.5];
      policy = "none_of_these";
      flags.push("low_signal");
    }
    theta.set(id, th);
    const typeId = /^T[1-8]$/.test(typeCell) ? typeCell : nearest(th);
    const nameCell = r[5] ?? "";
    let name = nameCell.replace(/^"|"$/g, "");
    if (nameCell.startsWith("name 30자"))
      name = fitLen("골목안쪽작은빵집과커피를함께하는한결같은동네가게오래머무는곳", 30);
    const feat = r[7] ?? "";
    const brand: Obj = {
      name: [...name].slice(0, 30).join(""),
      description: DEFAULT_ACTION_DESC[purpose] ?? "",
      primaryAction: r[6] ?? "",
    };
    if (!feat.includes("key_points 0개") && !feat.includes("key_points 3개"))
      brand.keyPoints = ["[임시] 핵심 장점 하나", "[임시] 핵심 장점 둘"];
    if (feat.includes("key_points 3개")) {
      brand.description = fitLen(
        "골목 안쪽에서 매일 아침 반죽을 하고 저녁까지 천천히 구워 내는 작은 빵집이며 계절 재료로 만든 디저트와 커피를 함께 내는 동네 사랑방 같은 곳입니다",
        80,
      );
      brand.keyPoints = [
        "매일 아침 직접 반죽해서 굽는 천연 발효 사워도우 빵과 계절 과일로 만든 타르트",
        "동네 단골이 오래 머물 수 있도록 창가 쪽에 넓은 테이블과 콘센트를 넉넉히 둔 자리",
        "주말에는 미리 예약한 손님에게 갓 구운 빵을 따뜻할 때 바로 포장해 드리는 서비스",
      ].map((x) => fitLen(x, 40)); // 7.2.3 GS-30: 전 필드 상한(01장 1.5.5.2)
    }
    if (feat.includes("key_points 영문")) brand.keyPoints = ["Fast payment", "Simple setup"];
    const color = /#[0-9A-F]{6}/i.exec(feat)?.[0];
    if (color) brand.brandColor = color.toUpperCase();
    if (feat.includes("audience")) brand.audience = "브랜드 문구가 필요한 작은 회사";
    const desc = /description "([^"]+)"/.exec(feat)?.[1];
    if (desc) brand.description = desc;
    const gs: Obj = {
      id,
      provenance: "temp",
      kind,
      purpose,
      persona: {
        thetaStar: Object.fromEntries(AXIS_KEY_BY_NAME.map((k, i) => [k, th[i] ?? 0])),
        simulator: { beta: 16, policy, seed: num },
      },
      answers: null,
      brand,
      expected: {
        typeId,
        anchorPresetId: `PS-${typeId}`,
        muRef: null,
        flags,
        brandNameIn: ["nav", "hero", "footer"],
        mustNotLint: ["error:*"],
        fallbackAllowed: false,
        ...(kind === "edge"
          ? {
              typeIdProvisional: !/^T[1-8]$/.test(typeCell),
              noteKo: edgeRows.get(id) ?? edgeRows.get("GS-26/27") ?? "",
            }
          : {}),
      },
    };
    out.push({ path: `data/golden/${id}.json`, content: stable(gs) });
  }
  if (out.length !== 32) throw new Error(`7.2.3 골든 ${out.length} ≠ 32`);
  return out;
}

// ---------- B14 linter/cliche_{ko,en}.json (04장 4.6.4 사전 v1 그대로) ----------
function clichePattern(text: string, lang: "ko" | "en"): string {
  const esc = (x: string): string => x.replace(/[.*+?^${}[\]\\]/g, "\\$&");
  if (lang === "ko") return esc(text.replace(/^~/, ""));
  // "seamless(ly)"·"next-gen(eration)" → 선택 접미, "(er|ing)" → 필수 대안
  return text
    .split(/(\([^)]*\))/)
    .map((part) => (part.startsWith("(") ? (part.includes("|") ? part : `${part}?`) : esc(part)))
    .join("");
}

function genCliche(ctx: Ctx): Out[] {
  const sec = section(chapter(ctx.root, "04_generation.md"), "### 4.6.4");
  const list = (label: string): string[] =>
    (new RegExp(`${label}\\(\\d+\\): (.+?)\\.\\n`).exec(sec)?.[1] ?? "")
      .split(" · ")
      .map((x) => x.trim());
  const ko = list("한국어");
  const en = list("영어");
  if (ko.length !== 48 || en.length !== 28)
    throw new Error(`4.6.4 사전 수 ko ${ko.length}/48 en ${en.length}/28`);
  const mk = (lang: "ko" | "en", arr: string[]): Obj[] =>
    arr.map((text, i) => ({
      id: `${lang}-${String(i + 1).padStart(2, "0")}`,
      text,
      pattern: clichePattern(text, lang),
      flags: "iu",
    }));
  return [
    { path: "data/linter/cliche_ko.json", content: bundle(ctx, "cliche", mk("ko", ko)) },
    { path: "data/linter/cliche_en.json", content: bundle(ctx, "cliche", mk("en", en)) },
  ];
}

// ---------- B17 legal/{terms,privacy,sources}.md (09장 9.2.4 B17: 임시 1줄 + 08장 필수 항목 제목) ----------
const LEGAL_SECTIONS: Record<string, string[]> = {
  terms: ["8.5", "8.6", "8.9"],
  privacy: ["8.7", "8.8"],
  sources: ["8.1", "8.4"],
};
const LEGAL_TITLE: Record<string, string> = {
  terms: "이용약관",
  privacy: "개인정보 처리방침",
  sources: "출처·라이선스 고지",
};
export const LEGAL_HUMAN_TODO =
  "- [ ] (B17, seed:temp 자동) 법무 문안 확정(변호사 검토 권장): legal/terms.md·privacy.md·sources.md";

function genLegal(ctx: Ctx): Out[] {
  const md = chapter(ctx.root, "08_legal.md");
  const heads = md.split("\n").filter((l) => /^#{2,3} 8\.\d/.test(l));
  return Object.entries(LEGAL_SECTIONS).map(([name, prefixes]) => {
    const titles = heads
      .filter((h) =>
        prefixes.some((p) => new RegExp(`^#{2,3} ${p.replace(".", "\\.")}(\\.|\\s)`).test(h)),
      )
      .map((h) => `- ${h.replace(/^#+ /, "")}`);
    return {
      path: `legal/${name}.md`,
      content: `# ${LEGAL_TITLE[name] ?? name}\n\n[임시 문안 — 08장 확정본으로 교체]\n\n## 08장 필수 항목\n\n${titles.join("\n")}\n`,
    };
  });
}

// ---------- B23 legal/processors.yaml(08장 8.7.6, 전부 approved:false) · data-flows.yaml(06장 6.1.3) ----------
function flowRows(
  root: string,
): { component: string; processorIds: string[]; process: string[]; transit: string[] }[] {
  const rows = table(section(chapter(root, "06_architecture.md"), "### 6.1.3"));
  return rows.map((r) => {
    const cells = r.slice(1, 14);
    const pick = (mark: string): string[] =>
      cells.map((c, i) => (c.includes(mark) ? `P${i + 1}` : "")).filter(Boolean);
    return {
      component: (r[0] ?? "").replace(/\(`[^)]*\)/g, "").trim(),
      processorIds: [...(r[0] ?? "").matchAll(/`([a-z-]+)`/g)].map((m) => m[1] ?? ""),
      process: pick("●"),
      transit: pick("○"),
    };
  });
}

function genProcessors(ctx: Ctx): Out[] {
  // 코드 블록 안 "# ..." 주석이 제목으로 잘리지 않게 다음 절 제목까지 직접 자른다
  const md8 = chapter(ctx.root, "08_legal.md");
  const sec = md8.slice(md8.indexOf("### 8.7.6 "), md8.indexOf("### 8.7.7 "));
  const block = /```yaml\n([\s\S]*?)```/.exec(sec)?.[1] ?? "";
  const list = (parseYaml(block) as Obj[]) ?? [];
  const flows = flowRows(ctx.root);
  const procs = list.map((p) => {
    const raw = (Array.isArray(p.items) ? p.items : []).map(String);
    const codes = new Set(raw.flatMap((x) => [...x.matchAll(/P\d+/g)].map((m) => m[0])));
    // 6.1.3 compliance:flows ①: items ⊇ 흐름표 해당 행(● ∪ ○) → 합집합(ASM-017)
    for (const f of flows)
      if (f.processorIds.includes(String(p.id)))
        for (const c of [...f.process, ...f.transit]) codes.add(c);
    const items = [...codes].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    return { ...p, items, items_note: raw.join(", "), approved: false, approved_by: null };
  });
  // 흐름표에만 있는 processor_id(llm-judge·llm-secondary·turnstile)는 확정 전 스텁으로 둔다(ASM-017)
  const known = new Set(procs.map((p) => String(p.id)));
  for (const f of flows)
    for (const id of f.processorIds)
      if (!known.has(id)) {
        known.add(id);
        const items = [
          ...new Set(
            flows
              .filter((g) => g.processorIds.includes(id))
              .flatMap((g) => [...g.process, ...g.transit]),
          ),
        ].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
        procs.push({
          id,
          name: "(확정 전 — 08장 8.7.6에 항목 없음)",
          purpose: f.component,
          items,
          items_note: "06장 6.1.3 흐름표에서 생성",
          approved: false,
          approved_by: null,
          stub: true,
        });
      }
  const flowsDoc = flows.map((f) => ({
    component: f.component,
    processor_ids: f.processorIds,
    process: f.process,
    transit: f.transit,
  }));
  const head = "# provenance: temp (seed:temp, 09장 9.2.4 B23). approved는 사람만 true로 바꾼다.\n";
  return [
    { path: "legal/processors.yaml", content: head + stringifyYaml(procs, { lineWidth: 0 }) },
    { path: "legal/data-flows.yaml", content: head + stringifyYaml(flowsDoc, { lineWidth: 0 }) },
  ];
}

/** 생성기 목록(의존 순서). 나머지 묶음은 M1-04b 이후 단위에서 추가한다. */
export const GENERATORS: ((ctx: Ctx) => Out[])[] = [
  genAxes,
  genTypes,
  genPurposes,
  genTaxonomy,
  genMapping,
  genPresets,
  genPalettes,
  genTextRoles,
  genIcons,
  genSignatures,
  genHarmony,
  genComponents,
  genBlocks,
  genTokenSchema,
  genFonts,
  genPairings,
  genImages,
  genTemplates,
  genCardPlan,
  genAbPlan,
  genApprovals,
  genReferences,
  genGolden,
  genCliche,
  genLegal,
  genProcessors,
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
  // config 묶음(B20~B24)은 seed-config.ts(순환 import라 호출 시점에 합친다)
  for (const gen of [...GENERATORS, ...CONFIG_GENERATORS])
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
  // 9.2.4 B17: 법무 문안 확정 항목을 HUMAN_TODO에 1회 추가(이미 있으면 그대로)
  const todo = join(root, "HUMAN_TODO.md");
  if (existsSync(todo) && !readFileSync(todo, "utf8").includes(LEGAL_HUMAN_TODO))
    writeFileSync(todo, `${readFileSync(todo, "utf8").replace(/\n*$/, "\n")}${LEGAL_HUMAN_TODO}\n`);
  return { written, skippedHuman };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = seedTemp(process.cwd());
  for (const p of r.skippedHuman) process.stdout.write(`skip(human) ${p}\n`);
  process.stdout.write(
    `seed:temp: ${r.written.length}개 파일 생성, human 건너뜀 ${r.skippedHuman.length}\n`,
  );
}
