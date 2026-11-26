// 00장 9.3 한도·06장 6.10 킬 스위치·예산·레이트리밋·초대(ASM-110). create_generation_job ③~⑥b의 TS 구현.
import { flagValue, q, type Tx } from "@tastefit/db";
import { serverEvent } from "./events";
import { ApiError } from "./http";
import { currentSeason } from "./survey";

/** 00장 9.3·6.10.4 사양 기본값(flags·env가 없을 때). */
export const QUOTA_DEFAULTS = {
  day: 3,
  month: 15,
  refundableCancelsPerDay: 2,
  genMinPerUser: 2,
  jobCostReserveUsd: 0.3,
  dailyBudgetUsd: 10,
  monthlyBudgetUsd: 150,
  userDailyCostCapUsd: 1.5,
} as const;
const KST_MS = 9 * 3_600_000;

/** 다음 KST 자정·다음 달 1일 KST 자정(UTC ISO). */
export function resets(now: Date): { day: string; month: string } {
  const k = new Date(now.getTime() + KST_MS);
  const day = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 1) - KST_MS;
  const month = Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 1) - KST_MS;
  return { day: new Date(day).toISOString(), month: new Date(month).toISOString() };
}

export interface QuotaView {
  dayLimit: number;
  dayUsed: number;
  monthLimit: number;
  monthUsed: number;
  resetDayAt: string;
  resetMonthAt: string;
  refundableCancelsLeft: number;
}
/** 사용 = 그 날(달) 예약 중 환불되지 않은 잡 수. */
export async function quotaOf(tx: Tx, uid: string, now: Date): Promise<QuotaView> {
  const at = now.toISOString();
  const u = await q(
    tx,
    "select quota_day_override, quota_month_override from users where id = $1",
    [uid],
  );
  const used = await q(
    tx,
    `select count(*) filter (where kst_day(r.created_at) = kst_day($2::timestamptz))::int as d,
            count(*) filter (where kst_month(r.created_at) = kst_month($2::timestamptz))::int as m
       from quota_ledger r
      where r.user_id = $1 and r.kind = 'reserve'
        and not exists (select 1 from quota_ledger f where f.job_id = r.job_id and f.kind = 'refund')`,
    [uid, at],
  );
  const rc = await q(
    tx,
    `select count(*)::int as n from quota_ledger q join generation_jobs j on j.id = q.job_id
      where q.user_id = $1 and q.kind = 'refund' and j.status = 'canceled' and kst_day(q.created_at) = kst_day($2::timestamptz)`,
    [uid, at],
  );
  const r = resets(now);
  return {
    dayLimit: Number(u.rows[0]?.quota_day_override ?? QUOTA_DEFAULTS.day),
    dayUsed: Number(used.rows[0]?.d ?? 0),
    monthLimit: Number(u.rows[0]?.quota_month_override ?? QUOTA_DEFAULTS.month),
    monthUsed: Number(used.rows[0]?.m ?? 0),
    resetDayAt: r.day,
    resetMonthAt: r.month,
    refundableCancelsLeft: Math.max(
      0,
      QUOTA_DEFAULTS.refundableCancelsPerDay - Number(rc.rows[0]?.n ?? 0),
    ),
  };
}

/** 6.10.1 고정 창 레이트리밋. 넘으면 429 RATE_LIMITED(retryAfterS). */
export async function rateLimit(
  tx: Tx,
  key: string,
  windowS: number,
  limit: number,
  now: Date,
): Promise<void> {
  const start = Math.floor(now.getTime() / (windowS * 1000)) * windowS * 1000;
  const r = await q(
    tx,
    `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1 returning count`,
    [key, new Date(start).toISOString()],
  );
  if (Number(r.rows[0]?.count) > limit) {
    const retry = Math.max(1, Math.ceil((start + windowS * 1000 - now.getTime()) / 1000));
    throw new ApiError("RATE_LIMITED", "rate limited", { retryAfterS: retry });
  }
}

const spend = async (tx: Tx, scope: "day" | "month", now: Date, uid?: string): Promise<number> => {
  const fn = scope === "day" ? "kst_day" : "kst_month";
  const r = await q(
    tx,
    `select coalesce(sum(cost_usd), 0)::float8 as c from llm_calls
      where purpose = 'user_job' and ${fn}(started_at) = ${fn}($1::timestamptz) and ($2::uuid is null or owner_id = $2)`,
    [now.toISOString(), uid ?? null],
  );
  return Number(r.rows[0]?.c ?? 0);
};
const num = async (tx: Tx, key: string, d: number): Promise<number> =>
  Number(await flagValue(tx, key, d));

/** create_generation_job ③ GEN_ENABLED ④ 일·월 예산 ⑤ 초대 ⑥ 일·월 한도 ⑥b 계정 원가. 실패는 ApiError. */
export async function admitGeneration(tx: Tx, uid: string, now: Date): Promise<QuotaView> {
  if ((await flagValue(tx, "GEN_ENABLED", true)) === false)
    throw new ApiError("GEN_DISABLED", "generation disabled");
  const r = resets(now);
  const reserve = QUOTA_DEFAULTS.jobCostReserveUsd;
  if (
    (await spend(tx, "day", now)) + reserve >
    (await num(tx, "GEN_DAILY_BUDGET_USD", QUOTA_DEFAULTS.dailyBudgetUsd))
  )
    throw new ApiError("GEN_BUDGET_EXCEEDED", "daily budget", { resetAt: r.day });
  if (
    (await spend(tx, "month", now)) + reserve >
    (await num(tx, "GEN_MONTHLY_BUDGET_USD", QUOTA_DEFAULTS.monthlyBudgetUsd))
  )
    throw new ApiError("GEN_BUDGET_EXCEEDED", "monthly budget", { resetAt: r.month });
  if ((await flagValue(tx, "BETA_INVITE_ONLY", false)) === true) {
    const inv = await q(tx, "select 1 from invite_redemptions where user_id = $1 limit 1", [uid]);
    if (inv.rowCount === 0) throw new ApiError("INVITE_REQUIRED", "invite required");
  }
  const qv = await quotaOf(tx, uid, now);
  if (qv.dayUsed >= qv.dayLimit)
    throw new ApiError("QUOTA_DAY", "daily quota", {
      limit: qv.dayLimit,
      resetAt: qv.resetDayAt,
      reason: "quota",
    });
  if (qv.monthUsed >= qv.monthLimit)
    throw new ApiError("QUOTA_MONTH", "monthly quota", {
      limit: qv.monthLimit,
      resetAt: qv.resetMonthAt,
      reason: "quota",
    });
  if (
    (await spend(tx, "day", now, uid)) >=
    (await num(tx, "USER_DAILY_COST_CAP_USD", QUOTA_DEFAULTS.userDailyCostCapUsd))
  )
    throw new ApiError("QUOTA_DAY", "user cost cap", {
      limit: qv.dayLimit,
      resetAt: qv.resetDayAt,
      reason: "cost_cap",
    });
  return qv;
}

/** 거부 서버 이벤트(00장 generate_rejected). */
export async function rejected(tx: Tx, anonId: string, uid: string, code: string): Promise<void> {
  await serverEvent(tx, {
    name: "generate_rejected",
    anonId,
    userId: uid,
    tv: await currentSeason(tx),
    props: { stage: "generation", code },
  });
}
