// 스택 health 검사(09장 9.4.2 ③). pg는 packages/db 밖에서 import하지 않는다(AC-06-59).
import pg from "pg";

export type Check = "ok" | "error";
export interface StackHealth {
  db: Check;
  queue: Check;
}

/** pg-boss 스키마 이름(worker가 migrate:true로 만든다, 06장). */
export const QUEUE_SCHEMA = "pgboss";

export async function stackHealth(
  connectionString: string,
  timeoutMs = 2000,
): Promise<StackHealth> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: timeoutMs });
  try {
    await client.connect();
    await client.query("SELECT 1");
    const q = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [QUEUE_SCHEMA]);
    return { db: "ok", queue: q.rowCount === 1 ? "ok" : "error" };
  } catch {
    return { db: "error", queue: "error" };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** web 접속 문자열: local은 DATABASE_URL_POOLED 미설정 시 DATABASE_URL_DIRECT(06장 6.13.1). */
export function webConnectionString(values: Readonly<Record<string, string>>): string {
  const url = values.DATABASE_URL_POOLED ?? values.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL_DIRECT 없음");
  return url;
}
