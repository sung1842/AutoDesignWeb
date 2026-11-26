// 06장 6.3.4 claim_generation_job의 TS 구현(ASM-112): 전역 슬롯(GEN_MAX_CONCURRENT_JOBS) 안에서 가장 오래된 queued 잡 1건을
// running으로 바꾼다(SKIP LOCKED, 동시 워커 안전). 대기열 소비는 DB 폴링(1s)이다. pg-boss는 재시도·스케줄 잡(M7)에 쓴다.
import { flagValue, q, type DbPort } from "@tastefit/db";

/** 6.10.4 GEN_MAX_CONCURRENT_JOBS 기본값(R-16). */
const MAX_CONCURRENT_DEFAULT = 5;

export async function claimNext(
  db: DbPort,
  workerId: string,
  o: { now?: Date } = {},
): Promise<string | null> {
  const at = (o.now ?? new Date()).toISOString();
  return db.withService(async (tx) => {
    if ((await flagValue(tx, "GEN_ENABLED", true)) === false) return null;
    await q(tx, "select pg_advisory_xact_lock(hashtext('gen:claim'))");
    const max = Number(await flagValue(tx, "GEN_MAX_CONCURRENT_JOBS", MAX_CONCURRENT_DEFAULT));
    const run = await q(
      tx,
      "select count(*)::int as n from generation_jobs where status = 'running'",
    );
    if (Number(run.rows[0]?.n) >= max) return null;
    const r = await q(
      tx,
      `update generation_jobs set status = 'running', phase = 'compiling', started_at = $2, heartbeat_at = $2, worker_id = $1
        where id = (select id from generation_jobs where status = 'queued' order by queued_at, id for update skip locked limit 1)
        returning id`,
      [workerId, at],
    );
    return r.rows[0] ? String(r.rows[0].id) : null;
  });
}
