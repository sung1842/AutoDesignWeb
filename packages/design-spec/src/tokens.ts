// 03장 3.1 deriveTokens(L2 → TokenSet, DTCG 해석 완료값). 순수·결정적. 해석은 ASSUMPTIONS ASM-031.
import { thresholdNumber } from "@tastefit/config";
import { contrast, fitGamut, oklchToHex, type L2 } from "@tastefit/taxonomy";
import type { DesignData, FontEntry, Palette, PairingFull, Preset } from "./data.js";
import { letterSpacingEmImpl } from "./signature.js";
import type { DerivedTokens } from "./types.js";

type Tok = { $type: string; $value: unknown; $extensions?: Record<string, unknown> };
type Group = { [k: string]: Tok | Group };
export type TokenSet = { $schemaVersion: "tokens-1" } & Record<string, unknown>;
type Lch = [number, number, number];

const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;
const px = (value: number): { value: number; unit: "px" } => ({ value, unit: "px" });
const dim = (value: number): Tok => ({ $type: "dimension", $value: px(value) });
const num = (value: number): Tok => ({ $type: "number", $value: value });

/** OKLCH → DTCG 색 값. 색역 밖이면 C를 낮춘다(3.4.3). */
export function colorValue(
  lch: Lch,
  alpha = 1,
): { colorSpace: "oklch"; components: Lch; alpha: number; hex: string } {
  const fit = fitGamut({ l: lch[0], c: lch[1], h: lch[2] });
  const comps: Lch = [
    r6(Math.min(1, Math.max(0, fit.l))),
    r6(fit.c),
    r6(((fit.h % 360) + 360) % 360),
  ];
  return { colorSpace: "oklch", components: comps, alpha, hex: oklchToHex(fit) };
}
const colorTok = (v: ReturnType<typeof colorValue>, source: string): Tok => ({
  $type: "color",
  $value: v,
  $extensions: { "app.tastefit": { source } },
});
/** 팔레트 표 값은 hex까지 그대로 쓴다(AC-03-44: 팔레트 값 불변). */
const paletteColor = (r: { oklch: Lch; hex: string }): ReturnType<typeof colorValue> => ({
  colorSpace: "oklch",
  components: [r.oklch[0], r.oklch[1], r.oklch[2]],
  alpha: 1,
  hex: r.hex.toUpperCase(),
});

/** 3.1.3 대비: 소수 둘째 자리 내림 비교. */
export const ratio2 = (a: string, b: string): number => Math.floor(contrast(a, b) * 100) / 100;

let limits: { body: number; large: number } | null = null;
function contrastLimits(): { body: number; large: number } {
  limits ??= {
    body: thresholdNumber("generation.contrastBodyMin"),
    large: thresholdNumber("generation.contrastLargeMin"),
  };
  return limits;
}

/** 3.1.4 neutral 램프 L. */
export const NEUTRAL_L: readonly [string, number][] = [
  ["50", 0.985],
  ["100", 0.965],
  ["200", 0.925],
  ["300", 0.87],
  ["400", 0.71],
  ["500", 0.555],
  ["600", 0.45],
  ["700", 0.37],
  ["800", 0.27],
  ["900", 0.205],
  ["950", 0.145],
];
/** 3.1.4 상태색 [라이트, 다크]. */
const STATUS: Record<string, [Lch, Lch]> = {
  success: [
    [0.5, 0.12, 150],
    [0.78, 0.13, 150],
  ],
  warning: [
    [0.53, 0.11, 65],
    [0.82, 0.12, 80],
  ],
  danger: [
    [0.53, 0.19, 27],
    [0.72, 0.15, 25],
  ],
};
/** 3.1.3 hover/active 파생 사양 상수. */
const PRIMARY_SPEC = { pivotL: 0.6, hoverDL: 0.06, activeDL: 0.04 } as const;
/** 3.1.11·3.1.4 기타 사양 상수. */
const MISC_SPEC = {
  neutralCMax: 0.012,
  neutralCAdd: 0.004,
  overlayMin: 0.35,
  overlayMax: 0.6,
  disabled: 0.45,
} as const;

function presetById(id: string, data: DesignData): Preset {
  const p = data.presets.find((x) => x.id === id);
  if (!p) throw new Error(`deriveTokens: 프리셋 없음 ${id}`);
  return p;
}
function paletteById(id: string | undefined, data: DesignData): Palette {
  const p = data.palettes.find((x) => x.id === id);
  if (!p) throw new Error(`deriveTokens: 팔레트 없음 ${String(id)}`);
  return p;
}

function colorGroup(
  pal: Palette,
  theme: "light" | "dark",
  overrides: Record<string, ReturnType<typeof colorValue>> = {},
): Group {
  const g: Group = {};
  // accent·on-accent는 없을 수 있다(null, 3.1.3 "0~1색")
  for (const [role, r] of Object.entries(pal.roles))
    if (r) g[role] = colorTok(paletteColor(r as { oklch: Lch; hex: string }), "palette");
  // 3.13 브랜드 색(applyBrandColor 결과)은 팔레트 값 위에 얹는다
  for (const [role, v] of Object.entries(overrides)) g[role] = colorTok(v, "brand");
  const prim = pal.roles.primary;
  if (!prim) throw new Error(`팔레트 primary 없음 ${pal.id}`);
  const hover = pal.roles["primary-hover"];
  const dir =
    hover !== undefined
      ? Math.sign(hover.oklch[0] - prim.oklch[0]) || 1
      : prim.oklch[0] >= PRIMARY_SPEC.pivotL
        ? 1
        : -1;
  if (!g["primary-hover"])
    g["primary-hover"] = colorTok(
      colorValue([prim.oklch[0] + dir * PRIMARY_SPEC.hoverDL, prim.oklch[1], prim.oklch[2]]),
      "formula",
    );
  const hv = (g["primary-hover"] as Tok).$value as ReturnType<typeof colorValue>;
  if (!g["primary-active"])
    g["primary-active"] = colorTok(
      colorValue([
        hv.components[0] + dir * PRIMARY_SPEC.activeDL,
        hv.components[1],
        hv.components[2],
      ]),
      "formula",
    );
  if (!g["focus-inverse"]) g["focus-inverse"] = structuredClone(g["fg-inverse"] as Tok);
  // 3.1.4 neutral 램프
  const bg = pal.roles.bg?.oklch ?? [1, 0, 0];
  const tint = (pal as Palette & { tintHue?: number | null }).tintHue;
  const nc =
    tint === undefined || tint === null
      ? 0
      : Math.min(MISC_SPEC.neutralCMax, bg[1] + MISC_SPEC.neutralCAdd);
  const neutral: Group = {};
  for (const [step, l] of NEUTRAL_L)
    neutral[step] = colorTok(colorValue([l, nc, tint ?? 0]), "formula");
  g.neutral = neutral;
  const n950 = (neutral["950"] as Tok).$value as ReturnType<typeof colorValue>;
  g.overlay = colorTok({ ...n950, alpha: MISC_SPEC.overlayMin }, "formula");
  const bgHex = (g.bg as Tok).$value as ReturnType<typeof colorValue>;
  for (const [name, [light, dark]] of Object.entries(STATUS)) {
    g[name] = colorTok(colorValue(theme === "dark" ? dark : light), "formula");
    g[`on-${name}`] =
      theme === "dark"
        ? colorTok({ ...bgHex }, "formula")
        : colorTok(colorValue([1, 0, 0]), "formula");
  }
  return g;
}

const fontById = (id: string | null | undefined, data: DesignData): FontEntry | undefined =>
  id ? data.fonts.find((f) => f.id === id) : undefined;
const generic = (cls: string): string => (cls === "serif" ? "serif" : "sans-serif");
const fallback = (cls: string): string => (cls === "serif" ? "tf-fb-serif" : "tf-fb-sans");

/** 3.7.4 스택. */
function fontGroup(pairing: PairingFull, headlineWeight: number, data: DesignData): Group {
  const head = fontById(pairing.headingFontId, data);
  const body = fontById(pairing.bodyFontId, data);
  const latin = fontById(pairing.headingLatinFontId, data);
  const mono = fontById(pairing.labelFontId, data);
  if (!head || !body) throw new Error(`페어링 서체 없음 ${pairing.code}`);
  const headStack = [
    ...(latin ? [latin.subsetFamily] : []),
    head.subsetFamily,
    fallback(pairing.classHeading),
    generic(pairing.classHeading),
  ];
  const g: Group = {
    heading: { $type: "fontFamily", $value: headStack },
    body: {
      $type: "fontFamily",
      $value: [body.subsetFamily, fallback(pairing.classBody), generic(pairing.classBody)],
    },
    weight: {
      heading: { $type: "fontWeight", $value: headlineWeight },
      body: { $type: "fontWeight", $value: 400 },
      emphasis: { $type: "fontWeight", $value: pairing.emphasisWeight },
    },
  };
  if (latin)
    g["heading-latin"] = {
      $type: "fontFamily",
      $value: [latin.subsetFamily, generic(latin.classification)],
    };
  if (mono && mono.classification === "mono")
    g.mono = { $type: "fontFamily", $value: [mono.subsetFamily, "ui-monospace", "monospace"] };
  return g;
}

/** 3.1.5 단계(이름 → n). 키는 type 그룹 토큰 이름, 값은 단계 이름(t-…)과 n. */
export const TYPE_STEPS: readonly { key: string; step: string; n: number }[] = [
  { key: "caption", step: "t-caption", n: -2 },
  { key: "small", step: "t-small", n: -1 },
  { key: "body", step: "t-body", n: 0 },
  { key: "lead", step: "t-lead", n: 1 },
  { key: "h4", step: "t-4", n: 2 },
  { key: "h3", step: "t-3", n: 3 },
  { key: "h2", step: "t-2", n: 4 },
  { key: "h1", step: "t-1", n: 5 },
  { key: "display", step: "t-display", n: 6 },
];
export { TYPE_SPEC } from "./type-spec.js";
import { TYPE_SPEC } from "./type-spec.js";
const MOBILE_RATIO: Record<string, number> = { "1.333": 1.25, "1.25": 1.2, "1.2": 1.15 };
/** 3.1.5 heading 행간: 크기 하한 내림차순. */
const HEADING_LEADING: readonly { fromPx: number; lh: number }[] = [
  { fromPx: 72, lh: 1.1 },
  { fromPx: 48, lh: 1.2 },
  { fromPx: 32, lh: 1.3 },
  { fromPx: 0, lh: 1.35 },
];

export function typeSizes(l2: L2): { key: string; step: string; d: number; m: number }[] {
  const base = Number(l2["type.body_size"]);
  const ratioKey = String(l2["type.scale_ratio"]);
  const ratio = Number(ratioKey);
  const boost = Number(l2["type.display_boost"]);
  const baseM = Math.max(TYPE_SPEC.mobileBaseMin, base - 1);
  const ratioM = MOBILE_RATIO[ratioKey] ?? ratio;
  const boostM = 1 + (boost - 1) / 2;
  return TYPE_STEPS.map(({ key, step, n }) => {
    const b = n >= TYPE_SPEC.boostFrom;
    let d = base * ratio ** n * (b ? boost : 1);
    if (key === "h1") d = Math.min(d, TYPE_SPEC.h1MaxX * base);
    if (key === "display") d = Math.min(d, TYPE_SPEC.displayMaxX * base);
    d = Math.round(d);
    if (n < 0) d = Math.max(TYPE_SPEC.minNegPx, d);
    let m: number;
    if (n < 0) m = d;
    else {
      m = baseM * ratioM ** n * (b ? boostM : 1);
      if (key === "h1") m = Math.min(m, TYPE_SPEC.mobileH1Max);
      if (key === "display") m = Math.min(m, TYPE_SPEC.mobileDisplayMax);
      m = Math.round(m);
    }
    return { key, step, d, m: Math.min(m, d) };
  });
}

function typeGroup(l2: L2, pairing: PairingFull, font: Group): Group {
  const headFam = (font.heading as Tok).$value;
  const bodyFam = (font.body as Tok).$value;
  const hw = ((font.weight as Group).heading as Tok).$value as number;
  const leading = Number(l2["type.body_leading"]);
  const headCls = pairing.classHeading === "serif" ? "serif" : "sans";
  const g: Group = {};
  for (const s of typeSizes(l2)) {
    const heading = s.key.startsWith("h") || s.key === "display";
    const lh = heading ? (HEADING_LEADING.find((r) => s.d >= r.fromPx)?.lh ?? leading) : leading;
    const ls = heading ? letterSpacingEmImpl(s.d, headCls) : 0;
    g[s.key] = {
      $type: "typography",
      $value: {
        fontFamily: heading ? headFam : bodyFam,
        fontSize: px(s.d),
        fontWeight: heading ? hw : 400,
        lineHeight: lh,
        letterSpacing: { value: ls, unit: "em" },
      },
      $extensions: {
        "app.tastefit": {
          source: "formula",
          step: s.step,
          mobileSize: s.m,
          // 3.8.2: 자간은 뷰포트별 계산 크기 기준 → 모바일 크기의 자간을 따로 둔다(ASM-043)
          mobileLetterSpacing: heading ? letterSpacingEmImpl(s.m, headCls) : 0,
        },
      },
    };
  }
  g["leading-body"] = num(leading);
  return g;
}

/** 3.1.6 원시 스케일. */
export const SPACE_SCALE: readonly [string, number][] = [
  ["0", 0],
  ["1", 4],
  ["2", 8],
  ["3", 12],
  ["4", 16],
  ["5", 20],
  ["6", 24],
  ["8", 32],
  ["10", 40],
  ["12", 48],
  ["16", 64],
  ["20", 80],
  ["24", 96],
  ["32", 128],
  ["40", 160],
];
/** 3.1.6 시맨틱 간격 [compact, regular, airy]. */
const SEMANTIC_SPACE: Record<string, [number, number, number]> = {
  "section-y": [64, 96, 128],
  "section-y-mobile": [48, 64, 80],
  "section-y-pad-minus": [48, 64, 96],
  "section-y-pad-plus": [80, 128, 160],
  stack: [12, 16, 24],
  "stack-lg": [32, 48, 64],
  inset: [12, 16, 24],
  card: [16, 24, 32],
  gap: [16, 24, 32],
};
const DENSITY_IDX: Record<string, number> = { compact: 0, regular: 1, airy: 2 };

function spaceGroup(l2: L2): Group {
  const g: Group = {};
  for (const [k, v] of SPACE_SCALE) g[k] = dim(v);
  const i = DENSITY_IDX[l2["space.density"] ?? "regular"] ?? 1;
  for (const [k, vals] of Object.entries(SEMANTIC_SPACE)) {
    const own = vals[i] ?? 0;
    g[k] = {
      $type: "dimension",
      $value: px(own),
      $extensions: { "app.tastefit": { source: "formula", l2Key: "space.density" } },
    };
  }
  // 모바일 pad ±1 = 한 단계 조밀한 밀도의 데스크톱 값(3.1.6 예: regular +1 모바일 = 80). compact는 스케일 한 단계 아래
  const scale = SPACE_SCALE.map(([, v]) => v);
  const down = (v: number): number => scale[Math.max(0, scale.indexOf(v) - 1)] ?? v;
  const mob = (k: string): number => {
    const vals = SEMANTIC_SPACE[k] ?? [0, 0, 0];
    return i > 0 ? (vals[i - 1] ?? 0) : down(vals[0]);
  };
  g["section-y-mobile-pad-minus"] = dim(mob("section-y-pad-minus"));
  g["section-y-mobile-pad-plus"] = dim(mob("section-y-pad-plus"));
  return g;
}

/** 3.1.7 [sm, md, lg]. full = 999. */
export const RADIUS_FAMILY: Record<string, [number, number, number]> = {
  sharp: [0, 0, 0],
  soft: [2, 4, 8],
  round: [6, 12, 20],
  pill: [8, 999, 24],
};
const RADIUS_FULL = 999;

function radiusGroup(l2: L2): Group {
  const [sm, md, lg] = RADIUS_FAMILY[l2["shape.radius_family"] ?? "sharp"] ?? [0, 0, 0];
  return { sm: dim(sm), md: dim(md), lg: dim(lg), full: dim(RADIUS_FULL) };
}

/** 3.1.9 [thin, thick]. */
const BORDER_WIDTH: Record<string, [number, number]> = {
  none: [1, 2],
  hairline: [1, 2],
  bold: [2, 3],
};
function borderGroup(l2: L2, color: Group): Group {
  const shape = l2["shape.border"] ?? "hairline";
  const [thin, thick] = BORDER_WIDTH[shape] ?? [1, 2];
  const g: Group = { width: { thin: dim(thin), thick: dim(thick) } };
  if (shape !== "none") {
    const c = shape === "bold" ? (color.fg as Tok) : (color.border as Tok);
    g.card = { $type: "border", $value: { color: c.$value, width: px(thin), style: "solid" } };
  }
  const input = color["border-strong"] as Tok;
  g.input = {
    $type: "border",
    $value: { color: input.$value, width: px(shape === "bold" ? 2 : 1), style: "solid" },
  };
  return g;
}

/** 3.1.8 그림자 층 [x, y, blur, spread, α]. α는 shadow.color(neutral.950) 위. */
type Layer = [number, number, number, number, number];
const SHADOWS: Record<string, [Layer[], Layer[], Layer[]]> = {
  "subtle-shadow": [
    [
      [0, 1, 2, 0, 0.06],
      [0, 2, 8, 0, 0.04],
    ],
    [
      [0, 4, 12, 0, 0.08],
      [0, 12, 32, 0, 0.06],
    ],
    [[0, 8, 24, 0, 0.1]],
  ],
  "layered-shadow": [
    [
      [0, 1, 0, 0, 0.04],
      [0, 2, 4, 0, 0.06],
      [0, 8, 16, 0, 0.06],
    ],
    [
      [0, 2, 4, 0, 0.06],
      [0, 8, 16, 0, 0.08],
      [0, 24, 48, 0, 0.1],
    ],
    [[0, 16, 48, 0, 0.14]],
  ],
};
/** brutal-offset 오프셋(px) level 1..3, glass α·blur level 1..3. */
const BRUTAL = [3, 6, 6] as const;
const GLASS: readonly [number, number][] = [
  [0.68, 16],
  [0.6, 24],
  [0.8, 16],
];

function shadowGroup(l2: L2, color: Group, theme: "light" | "dark"): Group {
  const n950 = ((color.neutral as Group)["950"] as Tok).$value as ReturnType<typeof colorValue>;
  const fg = (color.fg as Tok).$value;
  const style = l2["depth.style"] ?? "flat";
  const g: Group = { color: { $type: "color", $value: n950 } };
  const layer = (l: Layer): Record<string, unknown> => ({
    color: { ...n950, alpha: l[4] },
    offsetX: px(l[0]),
    offsetY: px(l[1]),
    blur: px(l[2]),
    spread: px(l[3]),
  });
  g["level-0"] = { $type: "shadow", $value: [] };
  for (const lv of [1, 2, 3]) {
    let v: unknown[] = [];
    // 다크 테마는 그림자 대신 surface 명도 상승(3.12)
    if (theme === "light") {
      const sh = SHADOWS[style];
      if (sh) v = (sh[lv - 1] ?? []).map(layer);
      if (style === "brutal-offset") {
        const o = BRUTAL[lv - 1] ?? 0;
        v = [{ color: fg, offsetX: px(o), offsetY: px(o), blur: px(0), spread: px(0) }];
      }
    }
    g[`level-${lv}`] = { $type: "shadow", $value: v };
  }
  if (style === "glass") {
    const glass: Group = {};
    GLASS.forEach(([a, b], i) => {
      glass[`alpha-${i + 1}`] = num(a);
      glass[`blur-${i + 1}`] = dim(b);
    });
    g.glass = glass;
  }
  return g;
}

/** 3.1.10. */
const MOTION_SPEC = { fast: 120, base: 200, slow: 320 } as const;
function motionGroup(l2: L2): Group {
  const ms = (value: number): Tok => ({ $type: "duration", $value: { value, unit: "ms" } });
  return {
    duration: {
      fast: ms(MOTION_SPEC.fast),
      base: ms(MOTION_SPEC.base),
      slow: ms(MOTION_SPEC.slow),
    },
    easing: {
      standard: { $type: "cubicBezier", $value: [0.2, 0, 0, 1] },
      emphasized: { $type: "cubicBezier", $value: [0.3, 0, 0, 1] },
    },
    enter: ms(l2["motion.level"] === "subtle" ? MOTION_SPEC.base : 0),
  };
}

/** 3.11.1 [이름, min-width, 컬럼, 거터, 바깥 여백]. */
export const BREAKPOINTS: readonly [string, number, number, number, number][] = [
  ["base", 0, 4, 16, 20],
  ["md", 768, 8, 24, 32],
  ["lg", 1024, 12, 24, 40],
  ["xl", 1280, 12, 32, 40],
  ["2xl", 1536, 12, 32, 40],
];
function layoutGroup(l2: L2): Group {
  const g: Group = { container: dim(Number(l2["space.container"])) };
  for (const [name, min, cols, gutter, margin] of BREAKPOINTS)
    g[name] = { min: dim(min), columns: num(cols), gutter: dim(gutter), margin: dim(margin) };
  return g;
}

/** 3.1.11 media.treatment → CSS filter 성분. duotone은 사전 처리 색 2개. */
function mediaGroup(l2: L2, color: Group): Group {
  const t = l2["media.treatment"] ?? "none";
  const g: Group = {
    grayscale: num(t === "grayscale" ? 1 : 0),
    contrast: num(t === "grayscale" ? 1.05 : 1),
    sepia: num(t === "warm-tint" ? 0.18 : 0),
    saturate: num(t === "warm-tint" ? 1.05 : 1),
  };
  if (t === "duotone") {
    const prim = (color.primary as Tok).$value as ReturnType<typeof colorValue>;
    const n950 = ((color.neutral as Group)["950"] as Tok).$value;
    const [l, c, h] = prim.components;
    g["duotone-shadow"] = { $type: "color", $value: n950 };
    g["duotone-highlight"] = colorTok(colorValue([Math.min(1, l + 0.35), c * 0.5, h]), "formula");
  }
  return g;
}

export interface DeriveInputLite {
  presetId: string;
  l2: L2;
  /** 3.13 applyBrandColor가 만든 색 역할 덮어쓰기. */
  overrides?: Record<string, ReturnType<typeof colorValue>>;
}

export function deriveTokensImpl(input: DeriveInputLite, data: DesignData): DerivedTokens {
  const preset = presetById(input.presetId, data);
  const l2 = input.l2;
  const pal = paletteById(l2["color.palette_id"], data);
  const theme = preset.theme;
  const pairing = data.pairingsFull.find((p) => p.code === l2["type.pairing_id"]);
  if (!pairing) throw new Error(`deriveTokens: 페어링 없음 ${String(l2["type.pairing_id"])}`);
  const hw = Number(l2["type.headline_weight"] ?? pairing.defaultHeadlineWeight);
  const color = colorGroup(pal, theme, input.overrides);
  const font = fontGroup(pairing, hw, data);
  const tokenSet: TokenSet = {
    $schemaVersion: "tokens-1",
    color,
    font,
    type: typeGroup(l2, pairing, font),
    space: spaceGroup(l2),
    radius: radiusGroup(l2),
    border: borderGroup(l2, color),
    shadow: shadowGroup(l2, color, theme),
    motion: motionGroup(l2),
    layout: layoutGroup(l2),
    media: mediaGroup(l2, color),
    z: { base: num(0), sticky: num(100), drawer: num(200), overlay: num(300) },
    opacity: {
      disabled: num(MISC_SPEC.disabled),
      overlay: { min: num(MISC_SPEC.overlayMin), max: num(MISC_SPEC.overlayMax) },
    },
  };
  const hex = (n: string): string | null => {
    const t = color[n] as Tok | undefined;
    return t ? (t.$value as { hex: string }).hex : null;
  };
  const { body, large } = contrastLimits();
  const acc = hex("accent");
  const accentTextSafe =
    acc !== null &&
    ratio2(acc, hex("bg") ?? "") >= body &&
    ratio2(acc, hex("surface") ?? "") >= body;
  const prim = hex("primary") ?? "";
  const inverseButtonMode =
    ratio2(prim, hex("surface-inverse") ?? "") >= large &&
    ratio2(hex("on-primary") ?? "", prim) >= body
      ? "primary"
      : "invert";
  // 3.1.3: 두 플래그는 TokenSet에 저장되고 컴파일러가 분기한다(ASM-055)
  tokenSet.$extensions = { "app.tastefit": { accentTextSafe, inverseButtonMode } };
  return { tokenSet, accentTextSafe, inverseButtonMode };
}

/** 3.1.5 보간: 375에서 m, 1280에서 d, clamp(m, A + B·vw/100, d). 반올림 없음. */
export function expectedSizeImpl(
  tokens: Record<string, unknown>,
  step: string,
  vw: number,
): number {
  const s = TYPE_STEPS.find((x) => x.step === step || x.key === step);
  if (!s) throw new Error(`expectedSize: 단계 없음 ${step}`);
  const tok = (tokens.type as Group | undefined)?.[s.key] as Tok | undefined;
  if (!tok) throw new Error(`expectedSize: 토큰 없음 type.${s.key}`);
  const d = (tok.$value as { fontSize: { value: number } }).fontSize.value;
  const m =
    (tok.$extensions?.["app.tastefit"] as { mobileSize?: number } | undefined)?.mobileSize ?? d;
  const B = (d - m) / ((TYPE_SPEC.vwDesktop - TYPE_SPEC.vwMobile) / 100);
  const A = m - B * (TYPE_SPEC.vwMobile / 100);
  return Math.min(d, Math.max(m, A + (B * vw) / 100));
}
