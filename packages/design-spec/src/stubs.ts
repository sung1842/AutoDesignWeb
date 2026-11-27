// M2-02~08에서 구현할 공개 함수(ASM-023~027 계약). 수용 테스트 수집이 깨지지 않도록 이름만 먼저 둔다.
import type { L1, L2 } from "@tastefit/taxonomy";
import type { DesignData } from "./data.js";
import {
  DEFAULT_BRAND,
  maxCharsJobImpl,
  patternRaw,
  resolveTree,
  STANDARD_PATTERN,
  templateDeck,
  type Brand,
} from "./standard.js";
import { compileSpecsImpl } from "./compile.js";
import { predictL1Vec } from "./predict.js";
import { exportTokensImpl } from "./export.js";
import { deriveTokensImpl, expectedSizeImpl } from "./tokens.js";
import { applyBrandColorImpl, type BrandResult } from "./brand.js";
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
/** 03장 3.1(ASM-031). 브랜드 색이 있으면 3.13 applyBrandColor 결과를 얹는다(ASM-032). */
export function deriveTokens(input: DeriveInput, data: DesignData): DerivedTokens {
  const paletteId = input.l2["color.palette_id"];
  const overrides =
    input.brand && paletteId
      ? applyBrandColorImpl({ presetId: input.presetId, paletteId, hex: input.brand.hex }, data)
          .overrides
      : undefined;
  return deriveTokensImpl({ presetId: input.presetId, l2: input.l2, overrides }, data);
}
export function exportTokens(
  d: DerivedTokens,
  meta: { presetId: string; l2: L2; taxonomyVersion: string },
): Record<string, string> {
  return exportTokensImpl(d, meta);
}
/** 03장 3.2.2(ASM-028). */
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
  /** 4.9.4 업종 태그(industryTags(BrandInput, data.imageTagKeywords), ASM-120). 없으면 []. */
  industryTags?: string[];
}
/** 04장 4.2.2(ASM-037). */
export function compileSpecs(input: CompileInput, data: DesignData): Record<Variant, DesignSpec> {
  return compileSpecsImpl(input, data);
}
/** 04장 4.6.2 maxChars_job(ASM-120 ③). */
export function maxCharsJob(specs: Record<Variant, DesignSpec>, data: DesignData): number {
  return maxCharsJobImpl(specs, data, expectedSizeImpl);
}
/** 03장 3.13(ASM-032). 반드시 4종 결과(+null) 중 하나로 끝나고 예외를 던지지 않는다. */
export function applyBrandColor(
  input: { presetId: string; paletteId: string; hex: string },
  data: DesignData,
): BrandResult {
  return applyBrandColorImpl(input, data);
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
  /** 브랜드 입력(4.12 템플릿 카피 치환: name·description·key_points). brandName보다 우선. */
  brand?: Partial<Brand>;
  copyOverride?: string;
  /** L2 전체 덮어쓰기(9.2.4 B18 코퍼스 렌더, ASM-068). 트리 제약은 앵커 명세 그대로. */
  l2?: L2;
}
/** 3.4.7 유형 앵커 취향(μ = predictL1(기본 L2), σ 확신, κ 0.8). */
export function anchorTaste(typeId: string, data: DesignData): TasteResult {
  const p = data.presets.find((x) => x.typeId === typeId);
  if (!p) throw new Error(`프리셋 없음 ${typeId}`);
  return {
    mu: predictL1Vec(p.l2, data),
    sigma: { expression: 0.08, temperature: 0.08, shape: 0.08, density: 0.08, depth: 0.08 },
    kappa: 0.8,
    insensitive_axes: [],
    type_id: typeId,
  };
}

function treeFor(
  spec: DesignSpec,
  purpose: string,
  data: DesignData,
  opts: TreeOptions = {},
): LayoutTreeLike {
  const brand: Brand = {
    ...DEFAULT_BRAND,
    ...(opts.brandName ? { name: opts.brandName } : {}),
    ...Object.fromEntries(
      Object.entries(opts.brand ?? {}).filter(([, v]) => v !== undefined && v !== ""),
    ),
  };
  const deck = templateDeck(purpose, data.root, brand);
  if (opts.copyOverride !== undefined) deck["hero.headline"] = [opts.copyOverride];
  const raw = patternRaw(spec, STANDARD_PATTERN[purpose] ?? "PS-1", deck, data);
  return resolveTree(raw, data, {
    deck,
    brand,
    seed: spec.spec_id,
    navVariant: spec.layout_constraints.allowed_variants.nav?.[0] ?? "nav.split",
    mediaMode: String(spec.l2["media.mode"]),
    budget: { tokens: spec.tokens, sizeOf: expectedSizeImpl },
  }) as unknown as LayoutTreeLike;
}

/** 페어링·팔레트 덮어쓰기(AC-03-23 등 검사용): l2를 바꾸고 토큰을 다시 만든다. */
function withOverrides(spec: DesignSpec, data: DesignData, opts: TreeOptions): DesignSpec {
  if (!opts.pairingId && !opts.paletteId && !opts.l2) return spec;
  const l2 = {
    ...spec.l2,
    ...(opts.l2 ?? {}),
    ...(opts.pairingId ? { "type.pairing_id": opts.pairingId } : {}),
    ...(opts.paletteId ? { "color.palette_id": opts.paletteId } : {}),
  } as L2;
  const preset = data.presets.find((x) => x.typeId === spec.type_id);
  const tokens = deriveTokensImpl({ presetId: preset?.id ?? "", l2 }, data).tokenSet;
  return { ...spec, l2, tokens };
}

/** 03장 standardTree(typeId, purpose): 앵커 v_true 명세 + 용도 표준 패턴 + 템플릿 카피(ASM-053). */
export function standardTree(
  typeId: string,
  purpose: string,
  data: DesignData,
  opts: TreeOptions = {},
): { spec: DesignSpec; tree: LayoutTreeLike } {
  const specs = compileSpecsImpl(
    {
      taste: anchorTaste(typeId, data),
      purpose: purpose as Purpose,
      brand: null,
      jobSeed: `standard:${typeId}:${purpose}`,
    },
    data,
  );
  const spec = withOverrides(specs.v_true, data, opts);
  return { spec, tree: treeFor(spec, purpose, data, opts) };
}

/** 04장 4.12 buildFallback(v): 해당 변형 명세(토큰 그대로) + 표준 트리 + 템플릿 카피. LLM 0회. */
export function fallbackMockup(
  typeId: string,
  purpose: string,
  variant: Variant,
  data: DesignData,
  opts: { spec?: DesignSpec } = {},
): { spec: DesignSpec; tree: LayoutTreeLike } {
  const spec =
    opts.spec ??
    compileSpecsImpl(
      {
        taste: anchorTaste(typeId, data),
        purpose: purpose as Purpose,
        brand: null,
        jobSeed: `fallback:${typeId}:${purpose}`,
      },
      data,
    )[variant];
  return { spec, tree: treeFor(spec, purpose, data) };
}
/** 브랜드 입력(BrandInput, 06장 brief) → 템플릿 치환용 Brand. */
function brandOf(b: unknown): Partial<Brand> {
  if (typeof b !== "object" || b === null) return {};
  const o = b as Record<string, unknown>;
  const kp = Array.isArray(o.key_points)
    ? o.key_points
    : Array.isArray(o.keyPoints)
      ? o.keyPoints
      : [];
  return {
    ...(typeof o.name === "string" ? { name: o.name.normalize("NFC") } : {}),
    ...(typeof o.description === "string" ? { description: o.description } : {}),
    key_points: kp.filter((x): x is string => typeof x === "string"),
  };
}

/** 04장 4.12 buildFallback(v): 해당 변형 명세(토큰 그대로) + 표준 트리 + 브랜드 템플릿 카피. LLM 0회(ASM-081 ①). */
export function buildFallback(
  input: { typeId: string; purpose: string; variant: Variant; spec?: DesignSpec; brand?: unknown },
  data: DesignData,
): { spec: DesignSpec; tree: LayoutTreeLike } {
  const { spec } = fallbackMockup(
    input.typeId,
    input.purpose,
    input.variant,
    data,
    input.spec ? { spec: input.spec } : {},
  );
  return { spec, tree: treeFor(spec, input.purpose, data, { brand: brandOf(input.brand) }) };
}
export type { L1 };
