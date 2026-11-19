// 03장 3.13 applyBrandColor(04장 4.2.2가 실행). 순수·결정적, 예외 없이 끝난다. 해석은 ASSUMPTIONS ASM-032.
import { thresholdNumber } from "@tastefit/config";
import { deltaEOk, hexToOklch } from "@tastefit/taxonomy";
import type { DesignData, Palette, PaletteRole } from "./data.js";
import type { DesignSpec } from "./types.js";
import { colorValue, ratio2 } from "./tokens.js";

type Lch = [number, number, number];
export type ColorVal = ReturnType<typeof colorValue>;
export type BrandNotice = DesignSpec["brand_color_notice"];
export type BrandRole = "primary" | "accent" | "tint" | null;
export interface BrandRecord {
  hex_in: string;
  hue_locked: number;
  role: "primary" | "accent";
  adjusted_hex: string;
  delta_e_ok: number;
}
export interface BrandResult {
  notice: BrandNotice;
  reason: string | null;
  role: BrandRole;
  /** 색 역할 → 덮어쓸 값(deriveTokens가 팔레트 값 위에 얹는다). */
  overrides: Record<string, ColorVal>;
  record: BrandRecord | null;
}

/** 3.13 사양 상수. */
export const BRAND_SPEC = {
  neutralC: 0.04,
  inverseLMax: 0.35,
  demoteHueDiff: 60,
  demoteC: 0.15,
  lStep: 0.01,
  lSteps: 25,
  cStep: 0.01,
  cSteps: 15,
  noticeDeltaE: 0.05,
  darkStartL: [0.7, 0.88] as const,
  accentCRatio: 1.3,
  tintCMax: 0.035,
  pivotL: 0.6,
  hoverDL: 0.06,
  activeDL: 0.04,
} as const;
/** 허용 팔레트에 vivid가 없는 유형(3.13.2). */
export const VIVID_FORBIDDEN: ReadonlySet<string> = new Set(["T1", "T2", "T3", "T4", "T7", "T8"]);
/** 3.14.1 accent 관계 범위(primary와의 hue 차, 도). */
export const ACCENT_HUE_RANGES: readonly [number, number][] = [
  [15, 45],
  [135, 165],
  [160, 200],
];

const clip = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;
export const hueDiff = (a: number, b: number): number => {
  const d = (((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
};

/** 3.13.1: `#RGB`·`#RRGGBB`(대소문자 무시) → `#RRGGBB` 대문자. 그 외 null. */
export function normalizeBrandHex(hex: string): string | null {
  const s = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s))
    return `#${[...s.slice(1)].map((ch) => ch + ch).join("")}`.toUpperCase();
  return null;
}

let lim: { body: number; large: number } | null = null;
function limits(): { body: number; large: number } {
  lim ??= {
    body: thresholdNumber("generation.contrastBodyMin"),
    large: thresholdNumber("generation.contrastLargeMin"),
  };
  return lim;
}

const roleHex = (pal: Palette, role: string): string | null => pal.roles[role]?.hex ?? null;
const fromRole = (r: PaletteRole): ColorVal => ({
  colorSpace: "oklch",
  components: [r.oklch[0], r.oklch[1], r.oklch[2]],
  alpha: 1,
  hex: r.hex.toUpperCase(),
});

/** 3.1.3 hover/active 파생(기준 L 0.6, 밝으면 +, 어두우면 −). */
export function hoverActive(p: ColorVal): { hover: ColorVal; active: ColorVal } {
  const [l, c, h] = p.components;
  const dir = l >= BRAND_SPEC.pivotL ? 1 : -1;
  const hover = colorValue([l + dir * BRAND_SPEC.hoverDL, c, h]);
  const [hl, hc] = hover.components;
  const active = colorValue([hl + dir * BRAND_SPEC.activeDL, hc, h]);
  return { hover, active };
}

/** L 오프셋을 가까운 순서로(0, +1, −1, +2, −2 …, ±25), C를 0.01씩 낮춰 가며 첫 해를 찾는다. 상한이 있어 반드시 끝난다. */
function search(start: Lch, ok: (v: ColorVal) => boolean): ColorVal | null {
  const [l0, c0, h] = start;
  for (let j = 0; j <= BRAND_SPEC.cSteps; j++) {
    const c = Math.max(0, r6(c0 - j * BRAND_SPEC.cStep));
    for (let k = 0; k <= BRAND_SPEC.lSteps; k++)
      for (const sgn of k === 0 ? [1] : [1, -1]) {
        const v = colorValue([clip(r6(l0 + sgn * k * BRAND_SPEC.lStep), 0, 1), c, h]);
        if (ok(v)) return v;
      }
    if (c === 0) break;
  }
  return null;
}

function tryPrimary(pal: Palette, theme: "light" | "dark", b: Lch): Record<string, ColorVal> | null {
  const { body, large } = limits();
  const bg = roleHex(pal, "bg") ?? "#FFFFFF";
  const onPal = pal.roles["on-primary"];
  const onA = onPal ? fromRole(onPal) : colorValue([1, 0, 0]);
  // 반대 극(라이트 ↔ 다크)
  const onB = onA.components[0] >= 0.5 ? colorValue([0.145, 0, 0]) : colorValue([1, 0, 0]);
  const startL =
    theme === "dark" ? clip(b[0], BRAND_SPEC.darkStartL[0], BRAND_SPEC.darkStartL[1]) : b[0];
  const start: Lch = [startL, b[1], b[2]];
  let best: { d: number; ov: Record<string, ColorVal> } | null = null;
  for (const on of [onA, onB]) {
    const p = search(start, (v) => {
      if (ratio2(v.hex, bg) < large) return false;
      const { hover, active } = hoverActive(v);
      return [v, hover, active].every((x) => ratio2(on.hex, x.hex) >= body);
    });
    if (!p) continue;
    const d = Math.abs(p.components[0] - startL) + Math.abs(p.components[1] - b[1]);
    if (best === null || d < best.d - 1e-9) {
      const { hover, active } = hoverActive(p);
      best = {
        d,
        ov: { primary: p, "primary-hover": hover, "primary-active": active, "on-primary": on },
      };
    }
  }
  return best?.ov ?? null;
}

function tryAccent(pal: Palette, b: Lch): Record<string, ColorVal> | null {
  const { large } = limits();
  const bg = roleHex(pal, "bg") ?? "#FFFFFF";
  const surface = roleHex(pal, "surface") ?? bg;
  const pc = pal.roles.primary?.oklch[1] ?? b[1];
  const c0 = Math.min(b[1], r6(pc * BRAND_SPEC.accentCRatio));
  const a = search([b[0], c0, b[2]], (v) => ratio2(v.hex, bg) >= large && ratio2(v.hex, surface) >= large);
  if (!a) return null;
  // on-accent 쓰임(배지 채움)은 강등 경로에서 금지지만, 값은 대비가 가장 큰 쪽으로 둔다.
  const cands: ColorVal[] = [colorValue([1, 0, 0]), colorValue([0.145, 0, 0])];
  const onPal = pal.roles["on-accent"];
  if (onPal) cands.unshift(fromRole(onPal));
  let on = cands[0] as ColorVal;
  for (const c of cands) if (ratio2(c.hex, a.hex) > ratio2(on.hex, a.hex)) on = c;
  return { accent: a, "on-accent": on };
}

function tryTint(pal: Palette, b: Lch): Record<string, ColorVal> | null {
  const { body, large } = limits();
  const s = pal.roles.surface;
  if (!s) return null;
  const v = colorValue([s.oklch[0], Math.min(BRAND_SPEC.tintCMax, b[1]), b[2]]);
  const checks: [string | null, number][] = [
    [roleHex(pal, "fg"), body],
    [roleHex(pal, "fg-muted"), body],
    [roleHex(pal, "focus"), large],
  ];
  return checks.every(([f, min]) => f === null || ratio2(f, v.hex) >= min) ? { surface: v } : null;
}

const NONE = (reason: string): BrandResult => ({
  notice: "ignored",
  reason,
  role: null,
  overrides: {},
  record: null,
});

export function applyBrandColorImpl(
  input: { presetId: string; paletteId: string; hex: string },
  data: DesignData,
): BrandResult {
  const preset = data.presets.find((p) => p.id === input.presetId);
  const pal = data.palettes.find((p) => p.id === input.paletteId);
  if (!preset || !pal) return NONE("brand_unknown_palette");
  const hex = normalizeBrandHex(input.hex);
  if (hex === null) return NONE("brand_invalid_format");
  const o = hexToOklch(hex);
  const b: Lch = [o.l, o.c, o.h];
  const theme = preset.theme;

  // 3.13.1 무채 브랜드 색
  if (o.c < BRAND_SPEC.neutralC) {
    const inv = pal.roles["surface-inverse"];
    const fgInv = roleHex(pal, "fg-inverse");
    if (theme === "light" && inv && o.l <= BRAND_SPEC.inverseLMax) {
      const v = colorValue([o.l, inv.oklch[1], inv.oklch[2]]);
      if (fgInv === null || ratio2(fgInv, v.hex) >= limits().body)
        return {
          notice: "used_as_tint",
          reason: "brand_neutral_inverse",
          role: "tint",
          overrides: { "surface-inverse": v },
          record: null,
        };
    }
    return NONE("brand_neutral_ignored");
  }

  const record = (role: "primary" | "accent", v: ColorVal): BrandRecord => ({
    hex_in: hex,
    hue_locked: r6(o.h),
    role,
    adjusted_hex: v.hex,
    delta_e_ok: r6(deltaEOk(hex, v.hex)),
  });
  const palPrimH = pal.roles.primary?.oklch[2] ?? o.h;
  const demote =
    hueDiff(o.h, palPrimH) >= BRAND_SPEC.demoteHueDiff &&
    VIVID_FORBIDDEN.has(preset.typeId) &&
    o.c > BRAND_SPEC.demoteC;

  let reason: string | null = null;
  if (!demote) {
    const ov = tryPrimary(pal, theme, b);
    if (ov) {
      const p = ov.primary as ColorVal;
      const rec = record("primary", p);
      return {
        notice: rec.delta_e_ok > BRAND_SPEC.noticeDeltaE ? "adjusted" : null,
        reason: null,
        role: "primary",
        overrides: ov,
        record: rec,
      };
    }
    reason = "brand_primary_infeasible";
  } else reason = "brand_hue_vivid_forbidden";

  // (a) accent 경로(3.13.3 관계 범위 안일 때만)
  const hd = hueDiff(o.h, palPrimH);
  if (ACCENT_HUE_RANGES.some(([lo, hi]) => hd >= lo && hd <= hi)) {
    const ov = tryAccent(pal, b);
    if (ov)
      return {
        notice: "demoted_to_accent",
        reason,
        role: "accent",
        overrides: ov,
        record: record("accent", ov.accent as ColorVal),
      };
    reason = `${reason}+accent_infeasible`;
  } else reason = `${reason}+accent_hue_out_of_range`;

  // (b) tint 경로
  const t = tryTint(pal, b);
  if (t) return { notice: "used_as_tint", reason, role: "tint", overrides: t, record: null };
  // (c) 반영 안 함
  return NONE(`${reason}+tint_infeasible`);
}
