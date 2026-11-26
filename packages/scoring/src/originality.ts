// 원본 유사도 가드(08장 8.3, 04장 4.10.6, G-11). 임계값 원천 = config/originality.json(08장 소유, ASM-078 ②④).
// MVP 규칙 G2(7속성 조합 일치)·G3(pHash)·G5(c)(연속 어절 일치)를 판정한다. G1은 명세 컴파일, G4·G6은 P2.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";

export interface OriginalityConfig {
  version: string;
  g1_min_domains: number;
  g2_max_matches: number;
  g2_delta_e_threshold: number;
  g3_phash_max_distance: number;
  g3_viewport: [number, number];
  g5_max_consecutive_words: number;
  g4_enabled: boolean;
  g6_enabled: boolean;
  [k: string]: unknown;
}
type Vec3 = [number, number, number];
export interface OriginalitySig {
  palette_oklab: { primary: Vec3; accent: Vec3 | null };
  font_substitute_ids: { display: string; body: string };
  radius_family_id: string;
  depth_id: string;
  layout_pattern_id: string;
}
export interface ReferenceSig extends OriginalitySig {
  reference_id: string;
  phash_1280: string | null;
  /** 저장된 레퍼런스 텍스트 필드(title·title_ko·blurb_ko, 8.3.2 G5). */
  texts: string[];
}
export interface OriginalityInput {
  sig: OriginalitySig;
  phash: string | null;
  texts: string[];
}
export interface OriginalityReport {
  config_version: string;
  passed: boolean;
  violated: ("G1" | "G2" | "G3" | "G4" | "G5" | "G6")[];
  nearest_reference_id: string | null;
  g2_matches: number;
  g2_matched_attrs: string[];
  min_phash_distance: number;
  min_phash_reference_id: string | null;
  g5_max_run: number;
}

export function loadOriginalityConfig(root: string = findRepoRoot()): OriginalityConfig {
  return JSON.parse(
    readFileSync(join(root, "config/originality.json"), "utf8"),
  ) as OriginalityConfig;
}

// ---------- OKLab → CIELAB(D65) → ΔE2000 ----------
function oklabToLinearSrgb([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const WHITE: Vec3 = [0.95047, 1, 1.08883];
const LAB_E = 216 / 24389;
const LAB_K = 24389 / 27;
const fLab = (t: number): number => (t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116);
export function oklabToCielab(c: Vec3): Vec3 {
  const [r, g, b] = oklabToLinearSrgb(c);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0];
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / WHITE[1];
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2];
  const [fx, fy, fz] = [fLab(x), fLab(y), fLab(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** CIEDE2000 각도 상수(반원·전원, °). */
const ANG = { half: 180, full: 360 } as const;
const rad = (d: number): number => (d * Math.PI) / ANG.half;
const deg = (r: number): number => (r * ANG.half) / Math.PI;
/** CIEDE2000(kL = kC = kH = 1). */
export function deltaE2000(lab1: Vec3, lab2: Vec3): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (a: number, b: number): number => {
    const v = deg(Math.atan2(b, a));
    return v < 0 ? v + ANG.full : v;
  };
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0) {
    dh = h2p - h1p;
    if (dh > ANG.half) dh -= ANG.full;
    else if (dh < -ANG.half) dh += ANG.full;
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2));
  const Lm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > ANG.half) hm += h2p + h1p < ANG.full ? ANG.full : -ANG.full;
    hm /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hm - 30)) +
    0.24 * Math.cos(rad(2 * hm)) +
    0.32 * Math.cos(rad(3 * hm + 6)) -
    0.2 * Math.cos(rad(4 * hm - 63));
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// ---------- G2 ----------
function g2Attrs(a: OriginalitySig, r: OriginalitySig, cfg: OriginalityConfig): string[] {
  const out: string[] = [];
  const same = (x: unknown, y: unknown): boolean => typeof x === "string" && x !== "" && x === y;
  const color = (x: Vec3 | null, y: Vec3 | null): boolean =>
    !!x && !!y && deltaE2000(oklabToCielab(x), oklabToCielab(y)) < cfg.g2_delta_e_threshold;
  if (same(a.font_substitute_ids.display, r.font_substitute_ids.display)) out.push("display");
  if (same(a.font_substitute_ids.body, r.font_substitute_ids.body)) out.push("body");
  if (color(a.palette_oklab.primary, r.palette_oklab.primary)) out.push("primary");
  if (color(a.palette_oklab.accent, r.palette_oklab.accent)) out.push("accent");
  if (same(a.radius_family_id, r.radius_family_id)) out.push("radius");
  if (same(a.depth_id, r.depth_id)) out.push("depth");
  if (same(a.layout_pattern_id, r.layout_pattern_id)) out.push("layout");
  return out;
}

// ---------- G3 ----------
function hamming(a: string, b: string): number {
  let d = 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = Number.parseInt(a[i] ?? "0", 16) ^ Number.parseInt(b[i] ?? "0", 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}
const PHASH_BITS = 64;

// ---------- G5(c) ----------
/** NFKC·소문자·문장부호 제거 후 공백 기준 어절. */
export function words(s: string): string[] {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
/** 두 어절열의 최장 연속 일치 길이. */
function longestRun(a: string[], b: string[]): number {
  let best = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++)
      if (a[i - 1] === b[j - 1]) {
        const v = (prev[j - 1] ?? 0) + 1;
        cur[j] = v;
        if (v > best) best = v;
      }
    prev = cur;
  }
  return best;
}

/** 후보 1개 vs 비교 집합(08장 8.3.2). 결과 = 8.3.3 OriginalityReport + g5_max_run. */
export function checkOriginality(
  input: OriginalityInput,
  refs: readonly ReferenceSig[],
  cfg: OriginalityConfig,
): OriginalityReport {
  let nearest: string | null = null;
  let best: string[] = [];
  let minD = PHASH_BITS;
  let minRef: string | null = null;
  let run = 0;
  const cand = input.texts.map(words);
  for (const r of refs) {
    const attrs = g2Attrs(input.sig, r, cfg);
    if (nearest === null || attrs.length > best.length) {
      nearest = r.reference_id;
      best = attrs;
    }
    if (input.phash && r.phash_1280) {
      const d = hamming(input.phash, r.phash_1280);
      if (d < minD || minRef === null) {
        minD = d;
        minRef = r.reference_id;
      }
    }
    for (const rt of r.texts.map(words))
      for (const c of cand) run = Math.max(run, longestRun(c, rt));
  }
  const violated: OriginalityReport["violated"] = [];
  if (best.length > cfg.g2_max_matches) violated.push("G2");
  if (minRef !== null && minD <= cfg.g3_phash_max_distance) violated.push("G3");
  if (run > cfg.g5_max_consecutive_words) violated.push("G5");
  return {
    config_version: cfg.version,
    passed: violated.length === 0,
    violated,
    nearest_reference_id: nearest,
    g2_matches: best.length,
    g2_matched_attrs: best,
    min_phash_distance: minD,
    min_phash_reference_id: minRef,
    g5_max_run: run,
  };
}
