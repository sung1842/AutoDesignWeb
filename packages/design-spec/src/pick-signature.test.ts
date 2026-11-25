// 04장 4.14 pickSignature 단위 테스트(ASM-034).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDesignData } from "./data.js";
import { PURPOSE_RANK, pickSignatures, signatureCandidates } from "./pick-signature.js";
import type { SigCtx } from "./types.js";

const data = loadDesignData(join(import.meta.dirname, "../../.."));
const base: SigCtx = {
  theme: "light",
  shapeBorder: "hairline",
  gridMode: "symmetric",
  motionLevel: "subtle",
  depthStyle: "flat",
  mediaTreatment: "none",
  chroma: "moderate",
  sectionCount: 6,
  hasNumberSlot: true,
  hasImageSlot: true,
  pairingHasMono: false,
  displayPx: 80,
};
const ctx3 = { v_true: base, v_fit: base, v_bal: base };

describe("pickSignatures 4.14", () => {
  it("8유형 × 3용도: 정확히 1개, SIG-05 아님, 후보 안, V-TRUE = 첫 후보, BAL은 가능하면 둘과 다름", () => {
    for (const p of data.presets)
      for (const purpose of ["saas", "local_business", "portfolio"] as const) {
        const cand = signatureCandidates(p, base);
        const r = pickSignatures(p, purpose, ctx3, 0.7);
        expect(r.v_true.id).toBe(cand[0]);
        for (const v of ["v_true", "v_fit", "v_bal"] as const) {
          expect(cand).toContain(r[v].id);
          expect(r[v].id).not.toBe("SIG-05");
        }
        expect(r.v_true.intensity).toBe(2);
        expect(r.v_fit.intensity).toBe(1);
        const others = cand.filter((x) => x !== r.v_true.id && x !== r.v_fit.id);
        if (others.length > 0) expect(others).toContain(r.v_bal.id);
      }
  });
  it("후보가 비면 SIG-01(조건 불가면 SIG-09), 순위표는 SIG-05 제외 11종", () => {
    const p = data.presets[0]!;
    const none: SigCtx = {
      ...base,
      sectionCount: 0,
      hasNumberSlot: false,
      hasImageSlot: false,
      motionLevel: "none",
      theme: "dark",
      displayPx: 0,
      gridMode: "bento",
    };
    expect(signatureCandidates({ ...p, signatureIds: ["SIG-05"] }, none)).toEqual(["SIG-01"]);
    expect(
      signatureCandidates({ ...p, signatureIds: ["SIG-05"] }, { ...none, shapeBorder: "bold" }),
    ).toEqual(["SIG-09"]);
    for (const r of Object.values(PURPOSE_RANK)) {
      expect(new Set(r).size).toBe(11);
      expect(r).not.toContain("SIG-05");
    }
    expect(pickSignatures(p, "saas", ctx3, 0.59).v_true.intensity).toBe(1);
  });
});
