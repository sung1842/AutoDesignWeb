// 린터 규칙 공통 도우미: computed 색·그라디언트·그림자 해석, 블록 메타, 트리·카피 접근(ASM-077).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CopyItem, LintFinding, Obj, RuleCtx, Severity } from "./types.js";

export const isObj = (x: unknown): x is Obj =>
  typeof x === "object" && x !== null && !Array.isArray(x);
/** 패키지 루트(src·dist/src 어디서 실행돼도 package.json이 있는 첫 상위). */
let PKG: string | null = null;
function pkgRoot(): string {
  if (PKG) return PKG;
  let d = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(d, "package.json"))) {
    const up = dirname(d);
    if (up === d) throw new Error("linter 패키지 루트를 찾지 못함");
    d = up;
  }
  PKG = d;
  return d;
}
export const pkgFile = (rel: string): string => join(pkgRoot(), rel);
export const repoFile = (rel: string): string => join(pkgRoot(), "../..", rel);
export const finding = (rule: string, severity: Severity, message: string): LintFinding => ({
  rule,
  severity,
  message,
});

/** NFC·공백 1칸 축약(4.6.4 매칭 규칙). */
export const norm = (s: string): string => s.normalize("NFC").replace(/\s+/g, " ").trim();

// ---------- 색 ----------
export interface Lch {
  l: number;
  c: number;
  h: number;
  alpha: number;
}
const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export function srgbToOklch(r: number, g: number, b: number, alpha = 1): Lch {
  const [R, G, B] = [lin(r / 255), lin(g / 255), lin(b / 255)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h, alpha };
}
const num = (s: string): number => {
  const t = s.trim();
  return t.endsWith("%") ? Number(t.slice(0, -1)) / 100 : Number(t);
};
/** computed 색 문자열(rgb·rgba·oklch·color(srgb)·#hex) → OKLCH. 해석 불가면 null. */
export function parseColor(s: string): Lch | null {
  const t = s.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(t);
  if (m) {
    const v = m[1] ?? "000000";
    const n = (i: number): number => parseInt(v.slice(i, i + 2), 16);
    return srgbToOklch(n(0), n(2), n(4), m[2] ? parseInt(m[2], 16) / 255 : 1);
  }
  m = /^rgba?\(([^)]*)\)$/.exec(t);
  if (m) {
    const p = (m[1] ?? "").split(/[\s,/]+/).filter(Boolean);
    const ch = (x: string | undefined): number =>
      x === undefined ? 0 : x.endsWith("%") ? num(x) * 255 : Number(x);
    return srgbToOklch(ch(p[0]), ch(p[1]), ch(p[2]), p[3] === undefined ? 1 : num(p[3]));
  }
  m = /^oklch\(([^)]*)\)$/.exec(t);
  if (m) {
    const p = (m[1] ?? "").split(/[\s/]+/).filter(Boolean);
    const L = p[0]?.endsWith("%") ? num(p[0]) : Number(p[0]);
    return { l: L, c: Number(p[1]), h: Number(p[2]) || 0, alpha: p[3] ? num(p[3]) : 1 };
  }
  m = /^color\(srgb ([^)]*)\)$/.exec(t);
  if (m) {
    const p = (m[1] ?? "").split(/[\s/]+/).filter(Boolean);
    return srgbToOklch(
      Number(p[0]) * 255,
      Number(p[1]) * 255,
      Number(p[2]) * 255,
      p[3] ? num(p[3]) : 1,
    );
  }
  return null;
}
/** OKLab 거리(ΔE_OK). */
export function deltaEOk(a: Lch, b: Lch): number {
  const ab = (x: Lch): [number, number] => [
    x.c * Math.cos((x.h * Math.PI) / 180),
    x.c * Math.sin((x.h * Math.PI) / 180),
  ];
  const [a1, b1] = ab(a);
  const [a2, b2] = ab(b);
  return Math.hypot(a.l - b.l, a1 - a2, b1 - b2);
}
const COLOR_RE = /(rgba?\([^)]*\)|oklch\([^)]*\)|color\(srgb [^)]*\)|#[0-9a-fA-F]{6,8}\b)/g;
/** 문자열 안의 색 토큰 전부. */
export const colorsIn = (s: string): Lch[] =>
  [...s.matchAll(COLOR_RE)].map((m) => parseColor(m[1] ?? "")).filter((c): c is Lch => !!c);

/** background-image의 그라디언트 함수 목록(이름 + 인자 원문). */
export function gradients(bg: string): { fn: string; body: string }[] {
  const out: { fn: string; body: string }[] = [];
  const re = /((?:repeating-)?(?:linear|radial|conic)-gradient)\(/g;
  for (let m = re.exec(bg); m; m = re.exec(bg)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < bg.length && depth > 0; i++) {
      if (bg[i] === "(") depth++;
      else if (bg[i] === ")") depth--;
    }
    out.push({ fn: m[1] ?? "", body: bg.slice(start, i - 1) });
  }
  return out;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: Lch | null;
  inset: boolean;
}
/** computed box-shadow·text-shadow → 층 목록. */
export function parseShadows(s: string): Shadow[] {
  if (!s || s === "none") return [];
  const layers: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      layers.push(cur);
      cur = "";
    } else cur += ch;
  }
  layers.push(cur);
  return layers.map((l) => {
    const color = colorsIn(l)[0] ?? null;
    const rest = l.replace(COLOR_RE, " ");
    const nums = [...rest.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
    return {
      x: nums[0] ?? 0,
      y: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      color,
      inset: /\binset\b/.test(l),
    };
  });
}
/** filter 문자열의 blur(px) 최댓값. */
export function blurPx(filter: string): number {
  const xs = [...filter.matchAll(/blur\(\s*([\d.]+)px\s*\)/g)].map((m) => Number(m[1]));
  return xs.length ? Math.max(...xs) : 0;
}

// ---------- 블록 메타·트리 ----------
interface VariantMeta {
  id: string;
  align: string;
  icon_grid: boolean;
}
let VARIANTS: Map<string, VariantMeta> | null = null;
export function variantMeta(id: string): VariantMeta | undefined {
  if (!VARIANTS) {
    const items = (
      JSON.parse(readFileSync(repoFile("data/taxonomy/blocks.json"), "utf8")) as {
        items: { variants: VariantMeta[] }[];
      }
    ).items;
    VARIANTS = new Map(items.flatMap((b) => b.variants.map((v) => [v.id, v] as const)));
  }
  return VARIANTS.get(id);
}

export interface TreeSection {
  id: string;
  block: string;
  variant: string;
  bg: string;
  pad: number;
  slots: Obj;
}
/** 트리 본문 섹션(nav·footer 제외). */
export function sections(tree: Obj | null): TreeSection[] {
  if (!tree || !Array.isArray(tree.sections)) return [];
  return (tree.sections as unknown[])
    .filter(isObj)
    .map((s) => ({
      id: String(s.id ?? ""),
      block: String(s.block ?? ""),
      variant: String(s.variant ?? ""),
      bg: String(s.bg ?? ""),
      pad: typeof s.pad === "number" ? s.pad : 0,
      slots: isObj(s.slots) ? s.slots : {},
    }))
    .filter((s) => s.block !== "nav" && s.block !== "footer");
}
/** 슬롯 값의 텍스트({copy:{text}}·{copy:"…"}·{link:{label}}). */
export function slotText(v: unknown): string | null {
  if (!isObj(v)) return typeof v === "string" ? v : null;
  if (isObj(v.copy)) return typeof v.copy.text === "string" ? v.copy.text : null;
  if (typeof v.copy === "string") return v.copy;
  if (isObj(v.link)) return slotText(v.link.label);
  if (typeof v.text === "string") return v.text;
  return null;
}
/** 섹션의 첫 list 슬롯 항목. */
export function listItems(s: TreeSection): unknown[] {
  for (const v of Object.values(s.slots))
    if (isObj(v) && Array.isArray(v.list)) return v.list as unknown[];
  return [];
}

// ---------- 카피 ----------
export function copyItems(ctx: RuleCtx): CopyItem[] {
  if (ctx.copy) return ctx.copy;
  return [];
}
export const HEADING_ROLES = /(headline|heading|title|button|cta|badge|eyebrow|label)/;
export const isHeadingRole = (role: string): boolean =>
  HEADING_ROLES.test(role) && role !== "body";
export const EMOJI = /\p{Extended_Pictographic}/gu;
export const emojiCount = (s: string): number =>
  [...s.matchAll(/\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu)].length;
/** 문장 분리(마침표·물음표·느낌표·줄바꿈). */
export const sentences = (s: string): string[] =>
  s
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
export const EXAMPLE_PREFIX = /^\s*\[예시\]/;

/** 브랜드 입력의 모든 문자열을 이어 붙인 것(AIL-14·21 대조). */
export function brandText(brand: Obj | null): string {
  if (!brand) return "";
  const out: string[] = [];
  const walk = (x: unknown): void => {
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (isObj(x)) Object.values(x).forEach(walk);
  };
  walk(brand);
  return norm(out.join(" "));
}

let PARAMS: Map<string, Obj> | null = null;
/** data/rule-params.json 항목(4.13.1: 탐지 상수 원천). */
export function params<T>(id: string): T {
  if (!PARAMS) {
    const items = (
      JSON.parse(readFileSync(pkgFile("data/rule-params.json"), "utf8")) as { items: Obj[] }
    ).items;
    PARAMS = new Map(items.map((i) => [String(i.id), i]));
  }
  const p = PARAMS.get(id);
  if (!p) throw new Error(`rule-params 항목 없음: ${id}`);
  return p as T;
}
/** spec.l2 값. */
export const l2Of = (spec: Obj | null, key: string): string | undefined =>
  spec && isObj(spec.l2) ? (spec.l2[key] as string | undefined) : undefined;
