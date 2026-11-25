// 04장 4.14 pickSignature(결정론). 요구 조건 원천은 03장 3.2.4(signature.ts). 해석은 ASSUMPTIONS ASM-034.
import type { Preset } from "./data.js";
import { signatureEligibleImpl } from "./signature.js";
import type { Purpose, SigCtx, Variant } from "./types.js";

/** 4.14 사양 상수: 후보가 비면 대체할 시그니처, V-TRUE intensity 2 기준(A1). */
export const PICK_SPEC = { fallbackId: "SIG-01", intensity2MinA1: 0.6 } as const;

/**
 * 용도 적합 순위(`signatures.json.purpose_rank`가 temp 데이터에 없어 사양 상수로 둔다, ASM-034 ②).
 * 앞일수록 적합. 사람 확인 대상(HUMAN_TODO).
 */
export const PURPOSE_RANK: Record<Purpose, readonly string[]> = {
  saas: [
    "SIG-01",
    "SIG-08",
    "SIG-02",
    "SIG-04",
    "SIG-09",
    "SIG-03",
    "SIG-12",
    "SIG-10",
    "SIG-07",
    "SIG-11",
    "SIG-06",
  ],
  local_business: [
    "SIG-12",
    "SIG-10",
    "SIG-07",
    "SIG-01",
    "SIG-09",
    "SIG-03",
    "SIG-02",
    "SIG-06",
    "SIG-08",
    "SIG-04",
    "SIG-11",
  ],
  portfolio: [
    "SIG-11",
    "SIG-03",
    "SIG-12",
    "SIG-02",
    "SIG-06",
    "SIG-04",
    "SIG-09",
    "SIG-10",
    "SIG-07",
    "SIG-08",
    "SIG-01",
  ],
};

export interface PickedSignature {
  id: string;
  intensity: 1 | 2;
}

/** 후보 = 유형 시그니처 후보 ∩ 요구 조건 충족(3.2.4). 비면 SIG-01, 그것도 불가하면 SIG-09(조건 없음). */
export function signatureCandidates(
  preset: Preset,
  ctx: SigCtx,
  fits: (id: string) => boolean = () => true,
): string[] {
  const c = preset.signatureIds.filter((id) => signatureEligibleImpl(id, ctx) && fits(id));
  if (c.length > 0) return c;
  return [signatureEligibleImpl(PICK_SPEC.fallbackId, ctx) ? PICK_SPEC.fallbackId : "SIG-09"];
}

export function pickSignatures(
  preset: Preset,
  purpose: Purpose,
  ctx: Record<Variant, SigCtx>,
  a1True: number,
  /** 4.2.2 11단계 대응: 장식 예산(decor.max) 등 명세 제약을 지키는 후보만(ASM-038 ②). */
  fits: (v: Variant, id: string) => boolean = () => true,
): Record<Variant, PickedSignature> {
  const rank = (id: string): number => {
    const i = PURPOSE_RANK[purpose].indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const cT = signatureCandidates(preset, ctx.v_true, (id) => fits("v_true", id));
  const cF = signatureCandidates(preset, ctx.v_fit, (id) => fits("v_fit", id));
  const cB = signatureCandidates(preset, ctx.v_bal, (id) => fits("v_bal", id));
  const tId = cT[0] as string;
  const fId = [...cF].sort(
    (x, y) => rank(x) - rank(y) || cF.indexOf(x) - cF.indexOf(y),
  )[0] as string;
  const bId =
    cB.find((id) => id !== tId && id !== fId) ?? (cB.includes(tId) ? tId : (cB[0] as string));
  return {
    v_true: { id: tId, intensity: a1True >= PICK_SPEC.intensity2MinA1 ? 2 : 1 },
    v_fit: { id: fId, intensity: 1 },
    v_bal: { id: bId, intensity: 1 },
  };
}
