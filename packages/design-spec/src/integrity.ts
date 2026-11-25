// 04장 G-12 명세 무결성·AIL-17 스케일 밖 값의 기준 집합(T-28, ASM-065). 순수 함수.
// ① specTokenDrift: deriveTokens(l2) == spec.tokens(잎 단위 비교). ② tokenReference: 뷰포트별 허용 값 집합.
import { applyBrandColorImpl } from "./brand.js";
import type { DesignData } from "./data.js";
import { tokenLeaves } from "./tokens-css.js";
import { TYPE_STEPS, deriveTokensImpl, expectedSizeImpl } from "./tokens.js";
import type { L2 } from "@tastefit/taxonomy";

/** AIL-17 색 허용 오차(04장 4.11 표 "ΔE_OK 0.01", 사양 값 그대로). */
export const INTEGRITY_DELTA_E_OK = 0.01;

export interface TokenReference {
  vw: number;
  /** 색 토큰(hex·alpha). 테두리 복합 토큰의 color도 포함. */
  colors: { name: string; hex: string; alpha: number }[];
  /** radius 토큰 px. */
  radii: number[];
  /** spacing 허용 px(space.* 원시·시맨틱 + layout gutter/margin + border 폭 0). */
  spaces: number[];
  /** 단계 → 이 뷰포트의 expectedSize(px). */
  fontSizes: Record<string, number>;
  tolerancePx: number;
  deltaEOk: number;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

function tolerancePx(data: DesignData): number {
  const h6 = data.harmony.find((h) => h.id === "H6");
  const t = isObj(h6) && isObj(h6.rule) ? h6.rule.tolerancePx : undefined;
  if (typeof t !== "number") throw new Error("tokenReference: harmony H6.rule.tolerancePx 없음");
  return t;
}

export function tokenReference(
  tokens: Record<string, unknown>,
  vw: number,
  data: DesignData,
): TokenReference {
  const colors: TokenReference["colors"] = [];
  const radii = new Set<number>();
  const spaces = new Set<number>([0]);
  for (const { path, tok } of tokenLeaves(tokens)) {
    const name = path.join(".");
    const v = tok.$value;
    if (tok.$type === "color" && isObj(v) && typeof v.hex === "string")
      colors.push({ name, hex: v.hex, alpha: typeof v.alpha === "number" ? v.alpha : 1 });
    else if (
      tok.$type === "border" &&
      isObj(v) &&
      isObj(v.color) &&
      typeof v.color.hex === "string"
    )
      colors.push({
        name: `${name}.color`,
        hex: v.color.hex,
        alpha: typeof v.color.alpha === "number" ? v.color.alpha : 1,
      });
    else if (tok.$type === "dimension" && isObj(v) && typeof v.value === "number") {
      if (path[0] === "radius") radii.add(v.value);
      else if (path[0] === "space") spaces.add(v.value);
      else if (path[0] === "layout" && (path[2] === "gutter" || path[2] === "margin"))
        spaces.add(v.value);
    }
  }
  const fontSizes: Record<string, number> = {};
  for (const s of TYPE_STEPS) fontSizes[s.step] = expectedSizeImpl(tokens, s.step, vw);
  return {
    vw,
    colors,
    radii: [...radii].sort((a, b) => a - b),
    spaces: [...spaces].sort((a, b) => a - b),
    fontSizes,
    tolerancePx: tolerancePx(data),
    deltaEOk: INTEGRITY_DELTA_E_OK,
  };
}

interface SpecLike {
  type_id: string;
  l2: L2;
  tokens: Record<string, unknown>;
  brand_color: null | { hex_in: string };
}

/** deriveTokens(l2[, 브랜드]) == spec.tokens. 다른 잎 경로를 돌려준다(빈 배열 = 일치). */
export function specTokenDrift(spec: unknown, data: DesignData): string[] {
  const s = spec as SpecLike;
  const preset = data.presets.find((p) => p.typeId === s.type_id);
  if (!preset) return [`프리셋 없음 ${String(s.type_id)}`];
  const paletteId = s.l2["color.palette_id"] ?? "";
  const br = s.brand_color
    ? applyBrandColorImpl({ presetId: preset.id, paletteId, hex: s.brand_color.hex_in }, data)
    : null;
  let derived: Obj;
  try {
    derived = deriveTokensImpl({ presetId: preset.id, l2: s.l2, overrides: br?.overrides }, data)
      .tokenSet as Obj;
  } catch (e) {
    return [`deriveTokens 실패: ${(e as Error).message}`];
  }
  const key = (t: Obj): string => JSON.stringify({ t: t.$type, v: t.$value });
  const a = new Map(tokenLeaves(derived).map((x) => [x.path.join("."), key(x.tok)]));
  const b = new Map(tokenLeaves(s.tokens).map((x) => [x.path.join("."), key(x.tok)]));
  const out: string[] = [];
  for (const [k, v] of a) if (b.get(k) !== v) out.push(k);
  for (const k of b.keys()) if (!a.has(k)) out.push(k);
  return out;
}
