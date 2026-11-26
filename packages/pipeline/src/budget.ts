// 06장 6.9.4 ③~⑤ 잡 예산 예약(ASM-110 ⑨). 예약 → 호출 → settle(실비) | release. 뮤텍스로 직렬화해 결정론·상한 보장.
import { getThresholds } from "@tastefit/config";

export type BudgetSkip = "cost_cap" | "skip_vision" | "skip_repair";
export interface JobBudget {
  readonly capEff: number;
  readonly skipVisionEff: number;
  readonly skipRepairEff: number;
  readonly spent: number;
  readonly reserved: number;
  reserve(
    est: number,
    call: { role: string; callKind: string },
  ): Promise<{ ok: true; id: string; reason?: undefined } | { ok: false; reason: BudgetSkip }>;
  settle(id: string, actual: number): Promise<void>;
  release(id: string): void;
}

function guard(): { capUsd: number; skipVisionUsd: number; skipRepairUsd: number } {
  const g =
    (getThresholds().generation as { costGuard?: Record<string, number> } | undefined)?.costGuard ??
    {};
  return {
    capUsd: Number(g.capUsd),
    skipVisionUsd: Number(g.skipVisionUsd),
    skipRepairUsd: Number(g.skipRepairUsd),
  };
}

/** jobCapUsd = JOB_COST_CAP_USD 플래그(0.05~0.30, 하향만). */
export function createJobBudget(o: { jobCapUsd: number }): JobBudget {
  const g = guard();
  const capEff = Math.min(o.jobCapUsd, g.capUsd);
  const ratio = capEff / g.capUsd;
  const skipVisionEff = g.skipVisionUsd * ratio;
  const skipRepairEff = g.skipRepairUsd * ratio;
  const holds = new Map<string, number>();
  let spent = 0;
  let seq = 0;
  let chain: Promise<unknown> = Promise.resolve();
  const reservedSum = (): number => [...holds.values()].reduce((a, b) => a + b, 0);
  const locked = <T>(fn: () => T): Promise<T> => {
    const p = chain.then(fn);
    chain = p.catch(() => undefined);
    return p;
  };
  return {
    capEff,
    skipVisionEff,
    skipRepairEff,
    get spent() {
      return spent;
    },
    get reserved() {
      return reservedSum();
    },
    reserve(est, call) {
      return locked(() => {
        const used = spent + reservedSum();
        // ⑤ stageSkip: 판정에 그 호출 자신의 est는 넣지 않는다
        if (call.role === "judge_vision" && used >= skipVisionEff)
          return { ok: false as const, reason: "skip_vision" as const };
        if (
          (call.callKind === "repair_quality" || call.callKind === "diversity") &&
          used >= skipRepairEff
        )
          return { ok: false as const, reason: "skip_repair" as const };
        // ③ reserve 성공 ⇔ spent + reserved + est ≤ capEff
        if (used + est > capEff + 1e-12) return { ok: false as const, reason: "cost_cap" as const };
        const id = `r${++seq}`;
        holds.set(id, est);
        return { ok: true as const, id };
      });
    },
    settle(id, actual) {
      return locked(() => {
        if (!holds.has(id)) return;
        holds.delete(id);
        spent += actual;
      });
    },
    release(id) {
      holds.delete(id);
    },
  };
}
