// 06장 6.6 retention 잡(일 1회). M5는 brief_drafts 만료 행 삭제만(01장 R-26, ASM-108 ②). 나머지 보관 규칙은 M7.
// 시계는 RETENTION_NOW 주입(테스트 전용, prod 기동 거부)으로 바꿀 수 있다.
import { q, type DbPort } from "@tastefit/db";

export interface RetentionResult {
  rule: string;
  deleted: number;
}

/** RETENTION_NOW 해석: `+25h`·`+31d`(상대) 또는 ISO 시각. 없으면 현재. */
export function retentionNow(raw: string | undefined, base: Date = new Date()): Date {
  if (!raw) return base;
  const m = /^\+(\d+)([hd])$/.exec(raw.trim());
  if (m) return new Date(base.getTime() + Number(m[1]) * (m[2] === "h" ? 3_600_000 : 86_400_000));
  const t = Date.parse(raw);
  if (Number.isNaN(t)) throw new Error(`RETENTION_NOW 형식 오류: ${raw}`);
  return new Date(t);
}

export async function runRetention(db: DbPort, o: { now?: Date } = {}): Promise<RetentionResult[]> {
  const now = (o.now ?? retentionNow(process.env.RETENTION_NOW)).toISOString();
  const out: RetentionResult[] = [];
  const r = await db.withService((tx) =>
    q(tx, "delete from brief_drafts where expires_at <= $1", [now]),
  );
  out.push({ rule: "brief_drafts_24h", deleted: r.rowCount });
  return out;
}
