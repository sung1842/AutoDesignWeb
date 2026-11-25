// 04장 4.2.2 compileSpec 조립(변형 3개를 함께 만든다, ASM-024 ①). 순수·결정적. 해석은 ASSUMPTIONS ASM-037.
import type { L1, L2 } from "@tastefit/taxonomy";
import { applyBrandColorImpl } from "./brand.js";
import type { DesignData } from "./data.js";
import { enforceVariantL2Diff, specId } from "./enforce.js";
import {
  copyTone,
  decorFor,
  heroVariants,
  layoutConstraints,
  patternSlots,
  sigCtx,
  signatureApplyTo,
} from "./layout.js";
import { pickSignatures } from "./pick-signature.js";
import { AXIS_KEYS } from "./predict.js";
import { l2Conflicts, mapL1toL2ForPurpose, presetOfType, snapToFeasible } from "./snap.js";
import { deriveTokensImpl } from "./tokens.js";
import type { DesignSpec, Purpose, TasteResult, Variant } from "./types.js";
import { variantTargets } from "./variants.js";

export interface CompileSpecsInput {
  taste: TasteResult;
  purpose: Purpose;
  brand: { brand_color: string } | null;
  jobSeed: string;
  /** BrandInput 업종 키워드에서 얻은 구체 이미지 태그(M5에서 연결, ASM-035 ⑥). */
  industryTags?: string[];
}

const VARIANTS: readonly Variant[] = ["v_true", "v_fit", "v_bal"];

export function compileSpecsImpl(
  input: CompileSpecsInput,
  data: DesignData,
): Record<Variant, DesignSpec> {
  const { taste, purpose, brand, jobSeed } = input;
  const typeId = taste.anchor_override_type_id ?? taste.type_id;
  const preset = presetOfType(typeId, data);
  const theme = preset.theme;
  const targets = variantTargets(taste, purpose, data);
  const slots = patternSlots(preset, purpose, jobSeed);
  const ctx = { typeId, purpose };

  // 2·3단계: 매핑 → 스냅
  const snapped = {} as Record<Variant, L2>;
  for (const v of VARIANTS) {
    const t = targets[v].target;
    const l1 = AXIS_KEYS.map((k) => t[k]) as unknown as L1;
    snapped[v] = snapToFeasible(
      mapL1toL2ForPurpose(l1, typeId, purpose, data),
      t,
      taste.sigma,
      ctx,
      data,
    );
  }

  const constraintsOf = (v: Variant, l2: L2): DesignSpec["layout_constraints"] =>
    layoutConstraints(preset, purpose, v, l2, slots[v], data, input.industryTags ?? []);
  const pick = (all: Record<Variant, L2>) =>
    pickSignatures(
      preset,
      purpose,
      {
        v_true: sigCtx(theme, all.v_true, constraintsOf("v_true", all.v_true), data),
        v_fit: sigCtx(theme, all.v_fit, constraintsOf("v_fit", all.v_fit), data),
        v_bal: sigCtx(theme, all.v_bal, constraintsOf("v_bal", all.v_bal), data),
      },
      targets.v_true.target.expression,
    );

  // 4단계: 변형 간 L2 차이(hero·signature 포함 7키)
  const enforced = enforceVariantL2Diff(
    {
      v_true: { l2: snapped.v_true, t: targets.v_true.target, sigma: taste.sigma, ctx },
      v_fit: { l2: snapped.v_fit, t: targets.v_fit.target, sigma: taste.sigma, ctx },
      v_bal: { l2: snapped.v_bal, t: targets.v_bal.target, sigma: taste.sigma, ctx },
    },
    (v, _l2, all) => [heroVariants(preset, purpose, v, data).join(","), pick(all)[v].id],
    data,
  );
  const l2s = enforced.l2;
  const sigs = pick(l2s);

  const out = {} as Record<Variant, DesignSpec>;
  for (const v of VARIANTS) {
    const l2 = l2s[v];
    const paletteId = l2["color.palette_id"] ?? "";
    // 5·6단계: 브랜드 색 → 토큰
    const br = brand
      ? applyBrandColorImpl({ presetId: preset.id, paletteId, hex: brand.brand_color }, data)
      : null;
    const tokens = deriveTokensImpl(
      { presetId: preset.id, l2, overrides: br?.overrides },
      data,
    ).tokenSet;
    // 7~10단계
    const c = constraintsOf(v, l2);
    const sig = sigs[v];
    const sigCtxV = { typeId, purpose, signatureId: sig.id };
    const versions = {
      taxonomy_version: data.taxonomyVersion,
      preset_version: preset.version,
      normalizer_version: data.normalizerVersion,
    };
    out[v] = {
      spec_version: "1",
      spec_id: specId({ ...versions, taste, purpose, brand, variant: v, job_seed: jobSeed }),
      variant: v,
      ...versions,
      type_id: typeId,
      diagnosed_type_id: taste.type_id,
      purpose,
      theme,
      target_vector: targets[v].target,
      calibration_trace: targets[v].trace,
      l2,
      tokens,
      layout_constraints: c,
      copy: copyTone(targets[v].target, purpose, v),
      signature: {
        id: sig.id,
        intensity: sig.intensity,
        apply_to: signatureApplyTo(sig.id, sig.intensity, c, data),
      },
      decor: decorFor(sig.id, l2, taste.kappa, v, data),
      forbidden: { lint_rules_strict: [], conflict_ids: l2Conflicts(l2, sigCtxV, data) },
      brand_color: br?.record ?? null,
      brand_color_notice: br ? br.notice : null,
    };
  }
  return out;
}
