// 06장 6.3.4 finish_generation_job·6.10.3 KS-2 동작의 TS 구현(ASM-110 ①). 한 트랜잭션, 사용자 잠금.
import { flagValue, q, type DbPort, type Tx } from "@tastefit/db";

/** 4.12 R-15. 템플릿 덱이면 succeeded 대신 partial(S-12). */
export function r15(nReal: number, nFallback: number, template = false): string {
  const s =
    nReal === 3 ? "succeeded" : nReal >= 1 ? "partial" : nFallback >= 1 ? "fallback" : "failed";
  return template && s === "succeeded" ? "partial" : s;
}
/** 00장 9.3: fallback·failed는 환불. */
const REFUND = new Set(["fallback", "failed"]);

async function refund(tx: Tx, userId: unknown, jobId: unknown, at: string): Promise<boolean> {
  const r = await q(
    tx,
    "insert into quota_ledger (user_id, job_id, kind, created_at) values ($1, $2, 'refund', $3) on conflict (job_id, kind) do nothing",
    [userId, jobId, at],
  );
  return r.rowCount > 0;
}

/** 노출 수(n_real·n_fallback)로 종료 상태 판정 → 필요 시 refund → finished_at. 이미 종료면 그대로. */
export async function finishGenerationJob(
  db: DbPort,
  jobId: string,
  o: { now?: Date; errorCode?: string | null } = {},
): Promise<{ status: string; refunded: boolean }> {
  const at = (o.now ?? new Date()).toISOString();
  return db.withService(async (tx) => {
    const j = (await q(tx, "select * from generation_jobs where id = $1 for update", [jobId]))
      .rows[0];
    if (!j) throw new Error(`job 없음 ${jobId}`);
    await q(tx, "select pg_advisory_xact_lock(hashtext($1))", [String(j.owner_id)]);
    if (!["queued", "running"].includes(String(j.status)))
      return { status: String(j.status), refunded: false };
    const status = r15(Number(j.n_real), Number(j.n_fallback), j.copy_source === "template");
    await q(
      tx,
      `update generation_jobs set status = $2, phase = 'done', progress_pct = 100, finished_at = $3,
         error_code = coalesce($4, error_code) where id = $1`,
      [
        jobId,
        status,
        at,
        status === "failed" ? (o.errorCode ?? "NO_ELIGIBLE") : (o.errorCode ?? null),
      ],
    );
    const refunded = REFUND.has(status) ? await refund(tx, j.owner_id, jobId, at) : false;
    return { status, refunded };
  });
}

/** KS-2: GEN_ENABLED=false면 queued 잡을 failed(GEN_DISABLED) + refund. 처리한 잡 수. */
export async function applyKillSwitch(db: DbPort, o: { now?: Date } = {}): Promise<number> {
  const at = (o.now ?? new Date()).toISOString();
  return db.withService(async (tx) => {
    if ((await flagValue(tx, "GEN_ENABLED", true)) !== false) return 0;
    const jobs = await q(
      tx,
      "update generation_jobs set status = 'failed', phase = 'done', error_code = 'GEN_DISABLED', finished_at = $1, progress_pct = 100 where status = 'queued' returning id, owner_id",
      [at],
    );
    for (const j of jobs.rows) await refund(tx, j.owner_id, j.id, at);
    return jobs.rowCount;
  });
}
