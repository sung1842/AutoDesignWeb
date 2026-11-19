// 03장 3.2.4 시그니처 요구 조건·충돌(AC-03-08), 3.8.2 자간 표(AC-03-27). 순수 함수.
import type { SigCtx } from "./types.js";

/** 3.2.4 요구 조건 수치(사양 상수 표). */
export const SIG_SPEC = { minSections: 4, minDisplayPx: 72 } as const;

/** 시그니처별 요구 조건 ∧ 충돌 없음. SIG-05는 예약(항상 불가), SIG-09는 조건·충돌 없음. */
const RULES: Record<string, (c: SigCtx) => boolean> = {
  "SIG-01": (c) => c.shapeBorder !== "bold",
  "SIG-02": (c) => c.sectionCount >= SIG_SPEC.minSections,
  "SIG-03": (c) => c.hasNumberSlot,
  "SIG-04": (c) => c.gridMode !== "bento" && c.depthStyle !== "glass",
  "SIG-05": () => false,
  "SIG-06": (c) => c.motionLevel === "subtle",
  "SIG-07": (c) => c.theme === "light" && c.depthStyle !== "glass",
  "SIG-08": (c) => c.pairingHasMono,
  "SIG-09": () => true,
  "SIG-10": (c) => c.chroma !== "vivid" && c.mediaTreatment === "duotone",
  "SIG-11": (c) => c.displayPx >= SIG_SPEC.minDisplayPx,
  "SIG-12": (c) => c.hasImageSlot,
};

export function signatureEligibleImpl(id: string, ctx: SigCtx): boolean {
  const rule = RULES[id];
  return rule ? rule(ctx) : false;
}

export type TrackingClass = "sans" | "serif" | "latin-heading";
/** 3.8.2 자간 표: 하한 px 내림차순 [하한, 고딕·display, 명조, 라틴 heading]. 24px 미만은 0. */
export const TRACKING_TABLE: readonly {
  fromPx: number;
  sans: number;
  serif: number;
  latin: number;
}[] = [
  { fromPx: 72, sans: -0.04, serif: -0.02, latin: -0.02 },
  { fromPx: 48, sans: -0.03, serif: -0.015, latin: -0.015 },
  { fromPx: 32, sans: -0.02, serif: -0.01, latin: -0.01 },
  { fromPx: 24, sans: -0.01, serif: -0.005, latin: 0 },
];

export function letterSpacingEmImpl(px: number, cls: TrackingClass): number {
  const row = TRACKING_TABLE.find((r) => px >= r.fromPx);
  if (!row) return 0;
  return cls === "sans" ? row.sans : cls === "serif" ? row.serif : row.latin;
}
