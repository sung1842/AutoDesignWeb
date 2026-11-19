// pnpm seed:temp (09장 9.2.4). 파일이 없거나 provenance temp인 묶음만 생성·덮어쓴다. human 파일은 쓰지 않는다.
//   결정성: 난수는 mulberry32(20261116)만, 시각·작성자 표기는 고정값 → 2회 실행 결과 바이트 동일.
//   다른 장에 값이 있으면 FINAL 장에서 그대로 옮긴다(spec-md.ts).
import { execFileSync } from "node:child_process";
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
        out[role] = v
          ? {
              oklch: [v.l, Math.round(v.c * 1e4) / 1e4, v.h],
              hex: hex[role] ?? "",
              ...(rv?.link ? { link: rv.link } : {}),
            }
          : null;
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
