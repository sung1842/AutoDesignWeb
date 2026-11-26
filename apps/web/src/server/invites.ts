// 00장 7.2 초대 코드(BETA_INVITE_ONLY). POST /api/invites/redeem {code} → 204 | 404(없음·만료) | 409(소진, ASM-110 ⑧).
import { InviteRedeemReqSchema } from "@tastefit/api-contract";
import { q } from "@tastefit/db";
import type { Deps } from "./api";
import { requireUser } from "./auth";
import { ApiError, parsed, type Ctx } from "./http";

export async function redeemInvite(c: Ctx, d: Deps, body: unknown): Promise<void> {
  const u = await requireUser(c, d);
  const b = parsed(InviteRedeemReqSchema.safeParse(body));
  const now = (d.now?.() ?? new Date()).toISOString();
  await d.db.withService(async (tx) => {
    const inv = (
      await q(
        tx,
        "select code, max_uses, used_count, expires_at > $2 as live from invites where code = $1 for update",
        [b.code, now],
      )
    ).rows[0];
    if (!inv || inv.live !== true) throw new ApiError("NOT_FOUND", "no invite");
    const mine = await q(tx, "select 1 from invite_redemptions where code = $1 and user_id = $2", [
      b.code,
      u.id,
    ]);
    if (mine.rowCount > 0) return;
    if (Number(inv.used_count) >= Number(inv.max_uses))
      throw new ApiError("INVITE_EXHAUSTED", "invite exhausted");
    await q(tx, "insert into invite_redemptions (code, user_id, redeemed_at) values ($1, $2, $3)", [
      b.code,
      u.id,
      now,
    ]);
    await q(tx, "update invites set used_count = used_count + 1 where code = $1", [b.code]);
  });
}
