// M2-02~08에서 구현할 공개 함수(ASM-023~027 계약). 수용 테스트 수집이 깨지지 않도록 이름만 먼저 둔다.
import type { L1, L2 } from "@tastefit/taxonomy";
import type { DesignData } from "./data.js";
import { todo } from "./todo.js";
import type {
  CalibrationTrace,
  DerivedTokens,
  DesignSpec,
  LayoutTreeLike,
  Purpose,
  SigCtx,
  TasteResult,
  Variant,
  Vec5,
} from "./types.js";

export interface DeriveInput {
  presetId: string;
  l2: L2;
  brand?: { hex: string } | null;
}
/** M2-03 전 자리표시: 빈 TokenSet(수용 테스트가 상위 수준에서 호출하므로 던지지 않는다). */
export function deriveTokens(_input: DeriveInput, _data: DesignData): DerivedTokens {
  void [_input, _data];
  return { tokenSet: {}, accentTextSafe: false, inverseButtonMode: "invert" };
}
export function exportTokens(
  _d: DerivedTokens,
  _meta: { presetId: string; l2: L2; taxonomyVersion: string },
): Record<string, string> {
  void [_d, _meta];
  return todo("M2-03", "exportTokens");
}
export function predictL1(_l2: L2, _data: DesignData): Vec5 {
  void [_data];
  return todo("M2-02", "predictL1");
}
export function signatureEligible(_id: string, _ctx: SigCtx): boolean {
  void [_id, _ctx];
  return todo("M2-03", "signatureEligible");
}
export function calibrate(
  _input: { taste: TasteResult; purpose: Purpose; alpha: number },
  _data: DesignData,
): CalibrationTrace {
  void [_input, _data];
  return todo("M2-02", "calibrate");
}
export interface CompileInput {
  taste: TasteResult;
  purpose: Purpose;
  brand: { brand_color: string } | null;
  jobSeed: string;
}
export function compileSpecs(_input: CompileInput, _data: DesignData): Record<Variant, DesignSpec> {
  void [_input, _data];
  return todo("M2-03", "compileSpecs");
}
export function applyBrandColor(
  _input: { presetId: string; paletteId: string; hex: string },
  _data: DesignData,
): {
  notice: DesignSpec["brand_color_notice"];
  reason: string | null;
  role: "primary" | "accent" | "tint" | null;
} {
  void [_input, _data];
  return todo("M2-03", "applyBrandColor");
}
export function expectedSize(_tokens: Record<string, unknown>, _step: string, _vw: number): number {
  void [_tokens, _step, _vw];
  return todo("M2-03", "expectedSize");
}
export function letterSpacingEm(_px: number, _cls: "sans" | "serif" | "latin-heading"): number {
  void [_px, _cls];
  return todo("M2-03", "letterSpacingEm");
}
export interface TreeOptions {
  pairingId?: string;
  paletteId?: string;
  brandName?: string;
  copyOverride?: string;
}
export function standardTree(
  _typeId: string,
  _purpose: string,
  _data: DesignData,
  _opts?: TreeOptions,
): { spec: DesignSpec; tree: LayoutTreeLike } {
  void [_typeId, _purpose, _data, _opts];
  return todo("M2-08", "standardTree");
}
export function fallbackMockup(
  _typeId: string,
  _purpose: string,
  _variant: Variant,
  _data: DesignData,
  _opts?: { spec?: DesignSpec },
): { spec: DesignSpec; tree: LayoutTreeLike } {
  void [_typeId, _purpose, _variant, _data, _opts];
  return todo("M2-08", "fallbackMockup");
}
export type { L1 };
