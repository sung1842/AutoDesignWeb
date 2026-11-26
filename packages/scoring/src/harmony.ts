// 조화 점수 H(03장 3.14.3~5, 04장 4.10.3, ASM-074). 상수 원천 = data/taxonomy/harmony.json(D-0310).
// 입력: DesignSpec(l2·tokens·signature·decor·forbidden.conflict_ids) + 확정 LayoutTree.
// 렌더 측정(render)·린터 위반(violations)은 선택 입력(09장 9.1.3 scoring 입력 `{Features, Violation[], DesignSpec}`).
// 주지 않으면 토큰에서 정적으로 판정한다: H6·H8·H9는 토큰 생성 값이라 만점, H12는 판정 보류(만점, measured "not_provided").
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "@tastefit/config";
import { staticLint } from "@tastefit/linter";

export interface HarmonyRender {
  /** OKLCH [L, C, h] */
  brandColors?: [number, number, number][];
  accentAreaRatio?: number;
  fontFamilies?: string[];
  fontWeights?: number[];
  /** 토큰 단계(±tolerancePx) 소속 비율 0~1 */
  typeScaleRatio?: number;
  /** 4pt 스케일 소속 비율 0~1 */
  spacingRatio?: number;
  /** radius family 집합 소속 비율 0~1 */
  radiusRatio?: number;
  displayPx?: number;
  bodyPx?: number;
  decorEffects?: string[];
}
export interface HarmonyOptions {
  render?: HarmonyRender;
  /** 린터 위반(단계 T). H12는 harmony.json H12.rule.rules에 든 규칙만 센다. */
  violations?: { rule: string }[];
  /** 호출자가 따로 판정한 상충 ID(합집합). */
  conflicts?: string[];
  /** 기본 = 저장소의 data/taxonomy/harmony.json */
  harmony?: HarmonyData;
}
export interface HarmonyItem {
  id: string;
  points: number;
  max: number;
  measured: unknown;
}
export interface HarmonyResult {
  score: number;
  /** = score(AC-03-20 테스트 시그니처) */
  total: number;
  items: HarmonyItem[];
  conflicts: string[];
  capped: boolean;
}

type Obj = Record<string, unknown>;
interface Tier {
  max?: number;
  eq?: number;
  min?: number;
  minRatio?: number;
  points: number;
}
export interface HarmonyData {
  items: Obj[];
}

let cached: HarmonyData | null = null;
export function loadHarmony(root: string = findRepoRoot()): HarmonyData {
  if (cached) return cached;
  cached = JSON.parse(
    readFileSync(join(root, "data/taxonomy/harmony.json"), "utf8"),
  ) as HarmonyData;
  return cached;
}

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const get = (o: unknown, ...path: string[]): unknown => {
  let cur: unknown = o;
  for (const k of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
};

function tierPoints(tiers: Tier[], v: number): number {
  for (const t of tiers) {
    if (t.minRatio !== undefined) {
      if (v >= t.minRatio) return t.points;
      continue;
    }
    if (t.max !== undefined && v <= t.max) return t.points;
    if (t.eq !== undefined && v === t.eq) return t.points;
    if (t.min !== undefined && v >= t.min) return t.points;
  }
  return 0;
}

type Lch = [number, number, number];
function tokenLch(tokens: unknown, name: string): Lch | null {
  const c = get(tokens, "color", name, "$value", "components");
  if (!Array.isArray(c)) return null;
  const [l, ch, h] = c as unknown[];
  if (l === undefined || ch === undefined || h === undefined) return null;
  return [num(l), num(ch), num(h)];
}
function lab([l, c, h]: Lch): [number, number, number] {
  const r = (h * Math.PI) / 180;
  return [l, c * Math.cos(r), c * Math.sin(r)];
}
function deltaE(a: Lch, b: Lch): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** 브랜드 색 후보 = 팔레트 역할 토큰(neutral·상태색·on-*·hover/active/focus·전경·경계 제외). */
const BRAND_ROLES = ["primary", "accent", "bg", "surface", "surface-inverse"] as const;

function brandColors(tokens: unknown, minC: number, mergeDE: number): Lch[] {
  const out: Lch[] = [];
  for (const role of BRAND_ROLES) {
    const c = tokenLch(tokens, role);
    if (!c || c[1] < minC) continue;
    if (out.some((o) => deltaE(o, c) < mergeDE)) continue;
    out.push(c);
  }
  return out;
}
function mergeColors(list: Lch[], minC: number, mergeDE: number): Lch[] {
  const out: Lch[] = [];
  for (const c of list) {
    if (c[1] < minC || out.some((o) => deltaE(o, c) < mergeDE)) continue;
    out.push(c);
  }
  return out;
}

function familyOf(tokens: unknown, key: string): string | null {
  const v = get(tokens, "font", key, "$value");
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
}
function tokenWeights(tokens: unknown): number[] {
  const set = new Set<number>();
  const w = get(tokens, "font", "weight");
  if (isObj(w)) for (const k of Object.keys(w)) set.add(num(get(w[k], "$value")));
  const type = get(tokens, "type");
  if (isObj(type))
    for (const k of Object.keys(type)) {
      const fw = get(type[k], "$value", "fontWeight");
      if (typeof fw === "number") set.add(fw);
    }
  set.delete(0);
  return [...set];
}
function typePx(tokens: unknown, step: string): number {
  return num(get(tokens, "type", step, "$value", "fontSize", "value"));
}

interface Section {
  block?: string;
  variant?: string;
  bg?: string;
  slots?: Obj;
}
function sectionsOf(tree: unknown): Section[] {
  const s = get(tree, "sections");
  return Array.isArray(s) ? (s.filter(isObj) as Section[]) : [];
}
function hasImage(sec: Section): boolean {
  if (sec.bg === "image") return true;
  const walk = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(walk);
    if (!isObj(v)) return false;
    if (isObj(v.image)) return true;
    return Object.values(v).some(walk);
  };
  return walk(sec.slots);
}
function slotText(sec: Section, slot: string): string {
  return str(get(sec.slots, slot, "copy", "text"));
}

// 3.14.4 CF-06 "순흑(L < 0.05)", CF-09 "장식 효과 3종 이상"(design-spec snap.ts CF_SPEC와 같은 값)
// CF-02 하드 그림자 = 05장 F07 정의(blur ≤ 2px & offset ≥ 3px)
const CF_SPEC = {
  decorConflictMin: 3,
  shadowBlackL: 0.05,
  hardBlurMax: 2,
  hardOffsetMin: 3,
} as const;

/** 그림자 토큰(level-*)의 층: blur·최대 offset(px). */
function shadowLayers(tokens: unknown): { blur: number; offset: number }[] {
  const sh = get(tokens, "shadow");
  if (!isObj(sh)) return [];
  const out: { blur: number; offset: number }[] = [];
  for (const [k, v] of Object.entries(sh)) {
    const val = get(v, "$value");
    if (!k.startsWith("level-") || !Array.isArray(val)) continue;
    for (const l of val)
      out.push({
        blur: num(get(l, "blur", "value")),
        offset: Math.max(
          Math.abs(num(get(l, "offsetX", "value"))),
          Math.abs(num(get(l, "offsetY", "value"))),
        ),
      });
  }
  return out;
}

const EYEBROW_NEW = /(new|신규|출시|✨|introducing)/i;

/** 명세·트리에서 판정 가능한 상충(나머지는 spec.forbidden.conflict_ids = design-spec l2Conflicts). */
function specConflicts(spec: unknown, tree: unknown, shadowBlackL: number): string[] {
  const out: string[] = [];
  const l2 = get(spec, "l2");
  const style = str(get(l2, "depth.style"));
  const sig = str(get(spec, "signature", "id"));
  const theme = str(get(spec, "theme"));
  const effects = get(spec, "decor", "effects");
  const secs = sectionsOf(tree);
  if (style === "glass" && !secs.some(hasImage)) out.push("CF-01");
  // CF-02 brutal-offset(blur ≤ 2·offset ≥ 3)과 흐린 그림자(blur > 2) 혼용: 그림자 토큰 층 기준
  const layers = shadowLayers(get(spec, "tokens"));
  if (
    layers.some((x) => x.blur <= CF_SPEC.hardBlurMax && x.offset >= CF_SPEC.hardOffsetMin) &&
    layers.some((x) => x.blur > CF_SPEC.hardBlurMax)
  )
    out.push("CF-02");
  // CF-07 보라→파랑 그라디언트 = AIL-01과 같은 판정(단계 S)
  if (staticLint(spec).some((f) => f.rule === "AIL-01")) out.push("CF-07");
  if (sig === "SIG-07" && style === "glass") out.push("CF-05");
  if (theme === "dark") {
    const tokens = get(spec, "tokens");
    const scRaw = get(tokens, "shadow", "color", "$value", "components");
    const sc: Lch | null = Array.isArray(scRaw)
      ? [num(scRaw[0]), num(scRaw[1]), num(scRaw[2])]
      : null;
    const shadow = get(tokens, "shadow");
    const used =
      isObj(shadow) &&
      Object.keys(shadow).some((k) => {
        const v = get(shadow[k], "$value");
        return k.startsWith("level-") && Array.isArray(v) && v.length > 0;
      });
    if (used && sc && sc[0] < shadowBlackL) out.push("CF-06");
    if (style === "brutal-offset") out.push("CF-10");
  }
  if (Array.isArray(effects) && effects.length >= CF_SPEC.decorConflictMin) out.push("CF-09");
  if (sig === "SIG-06" && str(get(l2, "motion.level")) === "none") out.push("CF-11");
  const hero = secs.find((s) => s.block === "hero");
  if (hero && /centered/.test(str(hero.variant)) && EYEBROW_NEW.test(slotText(hero, "eyebrow")))
    out.push("CF-12");
  return out;
}

export function harmonyScore(
  spec: unknown,
  tree: unknown,
  opts: HarmonyOptions = {},
): HarmonyResult {
  const hd = opts.harmony ?? loadHarmony();
  const byId = new Map(hd.items.map((i) => [str(i.id), i]));
  const k = byId.get("constants") ?? {};
  const rule = (id: string): Obj => (get(byId.get(id), "rule") as Obj | undefined) ?? {};
  const maxOf = (id: string): number => num(byId.get(id)?.points);
  const tiers = (id: string): Tier[] => (rule(id).tiers as Tier[] | undefined) ?? [];
  const tokens = get(spec, "tokens");
  const r = opts.render ?? {};
  const items: HarmonyItem[] = [];
  const push = (id: string, points: number, measured: unknown): void => {
    items.push({ id, points: Math.max(0, Math.min(maxOf(id), points)), max: maxOf(id), measured });
  };

  const minC = num(k.brandColorMinChroma, 0.04);
  const mergeDE = num(k.brandColorMergeDeltaE, 0.02);
  const achroma = num(k.achromaticPrimaryExempt, 0.04);

  // H1 브랜드 색 수
  const brands = r.brandColors
    ? mergeColors(r.brandColors, minC, mergeDE)
    : brandColors(tokens, minC, mergeDE);
  push("H1", tierPoints(tiers("H1"), brands.length), brands.length);

  // H2 색 관계
  const primary = tokenLch(tokens, "primary");
  const accent = tokenLch(tokens, "accent");
  let relation = "mono";
  let h2ok = true;
  if (!primary || primary[1] < achroma) relation = "achromatic-primary";
  else if (accent && accent[1] >= minC && deltaE(primary, accent) >= mergeDE) {
    const d = hueDiff(primary[2], accent[2]);
    const ranges = (k.relationRanges as Record<string, [number, number]> | undefined) ?? {};
    const hit = Object.entries(ranges).find(([, [lo, hi]]) => d >= lo && d <= hi);
    relation = hit ? hit[0] : `out:${d.toFixed(1)}`;
    h2ok = hit !== undefined;
  }
  push("H2", h2ok ? num(rule("H2").pass, 10) : num(rule("H2").fail), relation);

  // H3 채도 균형(조건 2개)
  const per = num(rule("H3").perCondition, 2.5);
  const ratioMax = num(k.accentChromaMaxRatio, 1.3);
  const c1 = !primary || primary[1] < achroma || !accent || accent[1] <= primary[1] * ratioMax;
  const bgMaxTable = (k.bgChromaMax as Record<string, number> | undefined) ?? {};
  const theme = str(get(spec, "theme"));
  const bgMax = bgMaxTable[theme] ?? bgMaxTable.light ?? 0.03;
  const bg = tokenLch(tokens, "bg");
  const c2 = !bg || bg[1] <= bgMax;
  push("H3", (c1 ? per : 0) + (c2 ? per : 0), { accentRatio: c1, bgChroma: c2 });

  // H4 폰트 패밀리(mono 제외)
  const fams =
    r.fontFamilies ??
    [familyOf(tokens, "heading"), familyOf(tokens, "body")].filter((x): x is string => x !== null);
  const nonMono = new Set(fams.filter((f) => !/mono/i.test(f)));
  push("H4", tierPoints(tiers("H4"), nonMono.size), nonMono.size);

  // H5 weight 종류
  const weights = new Set(r.fontWeights ?? tokenWeights(tokens));
  push("H5", tierPoints(tiers("H5"), weights.size), weights.size);

  // H6·H8·H9 비율(렌더 측정 없으면 토큰 생성 값 = 1)
  push("H6", tierPoints(tiers("H6"), r.typeScaleRatio ?? 1), r.typeScaleRatio ?? "tokens");
  // H7 display/body(1280)
  const disp = r.displayPx ?? typePx(tokens, "display");
  const body = r.bodyPx ?? typePx(tokens, "body");
  const ratio = body > 0 ? disp / body : 0;
  const [lo, hi] = (rule("H7").range as [number, number] | undefined) ?? [2.5, 8];
  push("H7", ratio >= lo && ratio <= hi ? num(rule("H7").pass, 8) : num(rule("H7").fail), ratio);
  push("H8", tierPoints(tiers("H8"), r.spacingRatio ?? 1), r.spacingRatio ?? "tokens");
  push("H9", tierPoints(tiers("H9"), r.radiusRatio ?? 1), r.radiusRatio ?? "tokens");

  // H10 상충 조합
  const forbidden = get(spec, "forbidden", "conflict_ids");
  const conflicts = [
    ...new Set([
      ...(Array.isArray(forbidden) ? forbidden.map(str) : []),
      ...specConflicts(spec, tree, CF_SPEC.shadowBlackL),
      ...(opts.conflicts ?? []),
    ]),
  ]
    .filter((x) => x !== "")
    .sort();
  push("H10", tierPoints(tiers("H10"), conflicts.length), conflicts);

  // H11 장식 예산
  const effects = r.decorEffects ?? (get(spec, "decor", "effects") as string[] | undefined) ?? [];
  const decorMax = num(get(spec, "decor", "max"), 2);
  const over = Math.max(0, new Set(effects).size - decorMax);
  push("H11", num(rule("H11").base, 6) + over * num(rule("H11").perOver, -3), {
    count: effects.length,
    max: decorMax,
  });

  // H12 리듬
  if (opts.violations) {
    const rules = new Set((rule("H12").rules as string[] | undefined) ?? []);
    const n = opts.violations.filter((v) => rules.has(v.rule)).length;
    push("H12", num(rule("H12").base, 8) + n * num(rule("H12").perViolation, -2), n);
  } else push("H12", num(rule("H12").base, 8), "not_provided");

  const raw = items.reduce((s, i) => s + i.points, 0);
  const cap = num(k.capWithConflict, 79);
  const capped = conflicts.length > 0 && raw > cap;
  const score = conflicts.length > 0 ? Math.min(raw, cap) : raw;
  return { score, total: score, items, conflicts, capped };
}
