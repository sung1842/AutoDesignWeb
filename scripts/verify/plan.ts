// verify 계획(09장 9.4.1): verify:mN은 누적이다 — guard → lint → typecheck → 단위 테스트 → qa:trace(≤mN)
//   → tests/acceptance/m0..mN → e2e m0..mN. M0 종료 시 자체 잠금(9.5.6).
export const MILESTONES = ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"] as const;
export type Milestone = (typeof MILESTONES)[number];

export function planFor(m: Milestone): string[] {
  const upto = MILESTONES.slice(0, MILESTONES.indexOf(m) + 1);
  return [
    "guard",
    "lint",
    "typecheck",
    "unit",
    "trace",
    ...upto.map((k) => `acceptance:${k}`),
    ...upto.map((k) => `e2e:${k}`),
  ];
}

export const verifyPlan: Record<Milestone, string[]> = Object.fromEntries(
  MILESTONES.map((m) => [m, planFor(m)]),
) as Record<Milestone, string[]>;

/** verify:fast(9.5.1): guard + lint·typecheck + HEAD^ 이후 변경에 영향받는 단위 테스트. 상한 3분. */
export const fastPlan = ["guard", "lint", "typecheck", "unit:changed"];
