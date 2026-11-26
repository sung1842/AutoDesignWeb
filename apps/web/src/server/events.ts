// 00장 8.2~8.3 이벤트 저장: 서버 이벤트(같은 트랜잭션)·POST /api/events(client). ASM-096.
import { randomUUID } from "node:crypto";
import { checkEvent, EventBatchSchema } from "@tastefit/api-contract";
import { q, type Tx } from "@tastefit/db";
import { ApiError, parsed } from "./http";

const APP_VERSION = process.env.APP_VERSION ?? "dev";

export async function serverEvent(
  tx: Tx,
  e: {
    name: string;
    anonId: string;
    userId?: string | null;
    tv: string;
    device?: string;
    props: Record<string, unknown>;
  },
): Promise<void> {
  const c = checkEvent(e.name, e.props, "server");
  if (!c.ok) throw new Error(`serverEvent: ${c.issue}`);
  await q(
    tx,
    `insert into events (event_id, name, ts, anon_id, user_id, session_id, source, app_version, taxonomy_version, device, props)
     values ($1, $2, now(), $3, $4, 'server', 'server', $5, $6, $7, $8)`,
    [
      randomUUID(),
      e.name,
      e.anonId,
      e.userId ?? null,
      APP_VERSION,
      e.tv,
      e.device ?? "desktop",
      JSON.stringify(c.props),
    ],
  );
}

/** client 배치: 하나라도 위반이면 전체 400·저장 0(ASM-096 ③). */
export async function clientEvents(
  tx: Tx,
  anonId: string,
  tv: string,
  body: unknown,
): Promise<void> {
  const b = parsed(EventBatchSchema.safeParse(body));
  const ok = b.events.map((e, i) => {
    const c = checkEvent(e.name, e.props, "client");
    if (!c.ok)
      throw new ApiError("VALIDATION_FAILED", c.issue, {
        issues: [{ path: `events.${i}`, code: "registry" }],
      });
    return { e, props: c.props };
  });
  for (const { e, props } of ok)
    await q(
      tx,
      `insert into events (event_id, name, ts, anon_id, session_id, source, app_version, taxonomy_version, device, referrer_host, utm, props)
       values ($1, $2, now(), $3, $4, 'client', $5, $6, $7, $8, $9, $10) on conflict (event_id) do nothing`,
      [
        e.eventId,
        e.name,
        anonId,
        e.sessionId,
        APP_VERSION,
        tv,
        e.device,
        e.referrerHost ?? null,
        e.utm ? JSON.stringify(e.utm) : null,
        JSON.stringify({ ...props, client_ts: e.clientTs }),
      ],
    );
}
