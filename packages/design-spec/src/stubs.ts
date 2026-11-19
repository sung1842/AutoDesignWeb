// M2-02~08에서 구현할 공개 함수(ASM-023~027 계약). 수용 테스트 수집이 깨지지 않도록 이름만 먼저 둔다.
import type { L1, L2 } from "@tastefit/taxonomy";
import type { DesignData } from "./data.js";
import { todo } from "./todo.js";
import { predictL1Vec } from "./predict.js";
import { deriveTokensImpl, expectedSizeImpl } from "./tokens.js";
import { letterSpacingEmImpl, signatureEligibleImpl } from "./signature.js";
import type {
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
/** 03장 3.1(ASM-031). 브랜드 색 반영은 M2-03c(applyBrandColor). */
export function deriveTokens(input: DeriveInput, data: DesignData): DerivedTokens {
  return deriveTokensImpl(input, data);
}
export function exportTokens(
  _d: DerivedTokens,
  _meta: { presetId: string; l2: L2; taxonomyVersion: string },
): Record<string, string> {
  void [_d, _meta];
  return todo("M2-03", "exportTokens");
}
/** 03장 3.2.2(ASM-032). */
export function predictL1(l2: L2, data: DesignData): Vec5 {
  return predictL1Vec(l2, data);
}
export function signatureEligible(id: string, ctx: SigCtx): boolean {
  return signatureEligibleImpl(id, ctx);
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
export function expectedSize(tokens: Record<string, unknown>, step: string, vw: number): number {
  return expectedSizeImpl(tokens, step, vw);
}
export function letterSpacingEm(px: number, cls: "sans" | "serif" | "latin-heading"): number {
  return letterSpacingEmImpl(px, cls);
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
