// 03장 3.2.2 predictL1(L2 → 의도 L1). 순수 함수. 해석은 ASSUMPTIONS ASM-028.
import { roundHalfToZero, type L2 } from "@tastefit/taxonomy";
import type { DesignData, JsonObj, Palette, Preset } from "./data.js";
import type { AxisKey, Vec5 } from "./types.js";

/** R-01 키 순서(A1..A5). */
export const AXIS_KEYS: readonly AxisKey[] = [
  "expression",
  "temperature",
  "shape",
  "density",
  "depth",
] as const;
const AXIS_OF: Record<string, AxisKey> = {
  A1: "expression",
  A2: "temperature",
  A3: "shape",
  A4: "density",
  A5: "depth",
};

interface Contribution {
  axis: string;
  weight: number;
  map: Record<string, number>;
}

const clip01 = (x: number): number => Math.min(1, Math.max(0, x));
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** 0.333·0.667처럼 3등분 값을 소수 셋째 자리로 적은 표기는 1/3·2/3으로 읽는다(ASM-028 ②). */
function thirds(v: number): number {
  const t = v * 3;
  const n = Math.round(t);
  return Math.abs(t - n) < 0.002 ? n / 3 : v;
}

/** 소수 둘째 자리 반올림. 0.5는 0 쪽으로(3.3.2 매핑 반올림과 같은 규칙, ASM-028 ③). */
export function round2(x: number): number {
  return roundHalfToZero(x * 100) / 100;
}

function contributions(data: DesignData, key: string): Contribution[] {
  const row = data.taxonomy.find((t) => t.id === key) as unknown as
    { l1Contribution?: Contribution[] } | undefined;
  return row?.l1Contribution ?? [];
}

function paletteOf(l2: L2, data: DesignData): Palette {
  const id = l2["color.palette_id"];
  const p = data.palettes.find((x) => x.id === id);
  if (!p) throw new Error(`predictL1: 팔레트 없음 ${String(id)}`);
  return p;
}

function presetOfPalette(pal: Palette, data: DesignData): Preset | undefined {
  return data.presets.find((p) => p.typeId === pal.typeId);
}

/** 브랜드 색 = primary·accent 중 C ≥ 0.04(3.2.2). */
function brandColors(pal: Palette): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const role of ["primary", "accent"]) {
    const r = pal.roles[role];
    if (r && r.oklch[1] >= 0.04) out.push(r.oklch);
  }
  return out;
}

/** 데스크톱 display 단계 크기(3.1.5: base·ratio^6·boost, 상한 8×base, 정수 px). */
export function displayPx(l2: L2): number {
  const base = Number(l2["type.body_size"]);
  const ratio = Number(l2["type.scale_ratio"]);
  const boost = Number(l2["type.display_boost"]);
  return Math.min(Math.round(base * ratio ** 6 * boost), 8 * base);
}

export interface PredictOptions {
  /** 시그니처 ID. 없으면 팔레트 유형 프리셋의 기본 시그니처(ASM-028 ①). */
  signatureId?: string;
}

/** 3.2.4 장식 효과 수: depth glass/brutal-offset, media duotone, 장식형 시그니처. */
export function decorCount(l2: L2, signatureId: string | undefined, data: DesignData): number {
  let n = 0;
  const style = l2["depth.style"];
  if (style === "glass" || style === "brutal-offset") n += 1;
  if (l2["media.treatment"] === "duotone") n += 1;
  if (signatureId) {
    const sig = data.signatures.find((s: JsonObj) => s.id === signatureId);
    const decorId = sig?.decorId;
    // duotone 시그니처(SIG-10)는 media.treatment = duotone과 같은 효과이므로 한 번만 센다
    if (typeof decorId === "string" && decorId !== "duotone") n += 1;
    if (decorId === "duotone" && l2["media.treatment"] !== "duotone") n += 1;
  }
  return n;
}

export function predictL1Raw(l2: L2, data: DesignData, opts: PredictOptions = {}): Vec5 {
  const acc: Record<AxisKey, number> = {
    expression: 0,
    temperature: 0,
    shape: 0,
    density: 0,
    depth: 0,
  };
  for (const [key, value] of Object.entries(l2)) {
    for (const c of contributions(data, key)) {
      const axis = AXIS_OF[c.axis];
      const v = c.map[value];
      if (!axis || v === undefined) continue;
      acc[axis] += c.weight * thirds(v);
    }
  }
  const pal = paletteOf(l2, data);
  const sigId = opts.signatureId ?? presetOfPalette(pal, data)?.defaultSignatureId;
  const dc = decorCount(l2, sigId, data);
  const decor = dc === 0 ? 0 : dc === 1 ? 0.5 : 1;
  const base = Number(l2["type.body_size"]);
  const R = displayPx(l2) / base;
  const scale = clip01((Math.log(R) - Math.log(2.5)) / (Math.log(8) - Math.log(2.5)));
  const brand = brandColors(pal);
  const cmax = brand.reduce((m, c) => Math.max(m, c[1]), 0);
  const chroma = clip01((cmax - 0.04) / 0.16);
  const ncolors = brand.length === 0 ? 0 : brand.length === 1 ? 0.5 : 1;
  acc.expression += 0.25 * decor + 0.25 * scale + 0.2 * chroma + 0.15 * ncolors;

  const warm =
    brand.length === 0
      ? 0.5
      : 0.5 +
        (0.5 * brand.reduce((s, c) => s + Math.cos(rad(c[2] - 50)) * Math.min(1, c[1] / 0.04), 0)) /
          brand.length;
  const bg = pal.roles.bg?.oklch ?? [1, 0, 0];
  const bgwarm = clip01(0.5 + (bg[1] * Math.sin(rad(bg[2]))) / 0.04);
  const pairing = data.pairings.find((p) => p.code === l2["type.pairing_id"]);
  if (!pairing) throw new Error(`predictL1: 페어링 없음 ${String(l2["type.pairing_id"])}`);
  const fontTemp = pairing.sig.temp;
  acc.temperature += 0.4 * warm + 0.3 * bgwarm + 0.3 * fontTemp;
  return acc;
}

/** 3.2.2 predictL1: 각 축 소수 둘째 자리(R-01 키 객체). */
export function predictL1Vec(l2: L2, data: DesignData, opts: PredictOptions = {}): Vec5 {
  const raw = predictL1Raw(l2, data, opts);
  const out = {} as Vec5;
  for (const k of AXIS_KEYS) out[k] = round2(raw[k]);
  return out;
}
