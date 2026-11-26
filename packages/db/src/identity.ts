// 00장 8.4 주체 병합: identity_links(anon_id, user_id). 이벤트의 user_id는 갱신하지 않는다(ASM-096 ④).
import { type Tx, q } from "./port.js";

export async function linkIdentity(tx: Tx, anonId: string, userId: string): Promise<boolean> {
  const r = await q(
    tx,
    "insert into identity_links (anon_id, user_id) values ($1, $2) on conflict do nothing",
    [anonId, userId],
  );
  return (r.rowCount ?? 0) > 0;
}
