// 06장 6.4.3 공유·신고·권리 요청(M5 범위, ASM-122).
// POST /api/share: 결과(anon·user 소유, 기본 공개) 또는 시안(user 소유, 기본 비공개·게이트 통과 버전만, 409 VERSION_GATE_NOT_PASSED).
// POST /api/share/:shareId/report: 신고 접수 202(본문의 "비밀번호"·"OTP" 같은 낱말은 걸러내지 않는다, AC-08-41d).
// POST /api/rights-requests: 08장 8.1.6 접수 201 {requestId, dueAt}. privacy_request는 본인 확인 대기(awaiting_verification).
import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  RightsRequestReqSchema,
  ShareCreateReqSchema,
  ShareReportReqSchema,
} from "@tastefit/api-contract";
import { q } from "@tastefit/db";
import type { Deps } from "./api";
import { requireUser } from "./auth";
import { ApiError, ensureAnon, parsed, type Ctx } from "./http";

/** 08장 8.1.6 처리 기한(시간). optout·copyright·trademark = 7일, privacy = 10일, abuse = 24시간. */
const DUE_HOURS: Record<string, number> = {
  optout_domain: 7 * 24,
  copyright_claim: 7 * 24,
  trademark_claim: 7 * 24,
  privacy_request: 10 * 24,
  abuse_report: 24,
};
/** 06장 6.4.3 privacy_request 본인 확인 토큰 유효 시간(발급 + 24시간). */
const VERIFY_TTL_H = 24;

const nowOf = (d: Deps): Date => d.now?.() ?? new Date();
/** 08장 IP 보관: 원문 대신 HMAC(IP_HMAC_KEY). */
function ipHmac(c: Ctx): string {
  const ip =
    c.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.headers.get("x-real-ip") ||
    "0.0.0.0";
  return createHmac("sha256", process.env.IP_HMAC_KEY ?? "")
    .update(ip)
    .digest("hex");
}
/** TURNSTILE_DRIVER=local은 비어 있지 않은 토큰을 통과시킨다(6.13.1). */
function turnstile(token: string): void {
  if (!token.trim()) throw new ApiError("TURNSTILE_FAILED", "turnstile");
}
const newShareId = (): string => randomBytes(16).toString("base64url");
const urlOf = (d: Deps, t: string, id: string): string =>
  `${d.webOrigin}/${t === "result" ? "r" : "p"}/${id}`;

export async function createShare(
  c: Ctx,
  d: Deps,
  body: unknown,
): Promise<{ status: 200 | 201; body: { shareId: string; url: string; isPublic: boolean } }> {
  const b = parsed(ShareCreateReqSchema.safeParse(body));
  if (b.targetType === "result") {
    const user = c.session ? await requireUser(c, d).catch(() => null) : null;
    const anon = c.anonId;
    return d.db.withService(async (tx) => {
      const r = (
        await q(
          tx,
          `select r.id, s.anon_id, s.user_id from diagnosis_results r join diagnosis_sessions s on s.id = r.session_id
            where r.id = $1`,
          [b.targetId],
        )
      ).rows[0];
      const mine =
        r &&
        ((user && r.user_id === user.id) ||
          (anon !== null && anon !== undefined && r.anon_id === anon));
      if (!r || !mine) throw new ApiError("NOT_FOUND", "no result");
      const old = (
        await q(tx, "select id, is_public from share_links where result_id = $1", [b.targetId])
      ).rows[0];
      if (old)
        return {
          status: 200 as const,
          body: {
            shareId: String(old.id),
            url: urlOf(d, "result", String(old.id)),
            isPublic: old.is_public === true,
          },
        };
      const id = newShareId();
      await q(
        tx,
        `insert into share_links (id, target_type, result_id, owner_user_id, owner_anon_id, is_public)
         values ($1, 'result', $2, $3, $4, true)`,
        [id, b.targetId, user?.id ?? null, user ? null : (anon ?? null)],
      );
      return {
        status: 201 as const,
        body: { shareId: id, url: urlOf(d, "result", id), isPublic: true },
      };
    });
  }
  const u = await requireUser(c, d);
  return d.db.withService(async (tx) => {
    const m = (
      await q(tx, "select id, owner_id, current_version_id from mockups where id = $1", [
        b.targetId,
      ])
    ).rows[0];
    if (!m || m.owner_id !== u.id) throw new ApiError("NOT_FOUND", "no mockup");
    const versionId = b.versionId ?? (m.current_version_id as string | null);
    const v = versionId
      ? (
          await q(
            tx,
            "select id, gate_status from mockup_versions where id = $1 and mockup_id = $2",
            [versionId, b.targetId],
          )
        ).rows[0]
      : undefined;
    if (!v) throw new ApiError("NOT_FOUND", "no version");
    if (v.gate_status !== "passed")
      throw new ApiError("VERSION_GATE_NOT_PASSED", "version gate not passed", {
        versionId,
        gateStatus: v.gate_status,
      });
    const old = (
      await q(tx, "select id, is_public from share_links where mockup_id = $1", [b.targetId])
    ).rows[0];
    if (old) {
      await q(tx, "update share_links set version_id = $2 where id = $1", [old.id, versionId]);
      return {
        status: 200 as const,
        body: {
          shareId: String(old.id),
          url: urlOf(d, "mockup", String(old.id)),
          isPublic: old.is_public === true,
        },
      };
    }
    const id = newShareId();
    await q(
      tx,
      `insert into share_links (id, target_type, mockup_id, version_id, owner_user_id, is_public)
       values ($1, 'mockup', $2, $3, $4, false)`,
      [id, b.targetId, versionId, u.id],
    );
    return {
      status: 201 as const,
      body: { shareId: id, url: urlOf(d, "mockup", id), isPublic: false },
    };
  });
}

export async function reportShare(c: Ctx, d: Deps, shareId: string, body: unknown): Promise<void> {
  const b = parsed(ShareReportReqSchema.safeParse(body));
  turnstile(b.turnstileToken);
  if (!/^[A-Za-z0-9_-]{22}$/.test(shareId)) throw new ApiError("NOT_FOUND", "no share");
  const reporter = ensureAnon(c);
  const user = c.session ? await requireUser(c, d).catch(() => null) : null;
  await d.db.withService(async (tx) => {
    const s = (
      await q(
        tx,
        "select id, target_type, version_id, owner_user_id from share_links where id = $1",
        [shareId],
      )
    ).rows[0];
    if (!s) throw new ApiError("NOT_FOUND", "no share");
    const ownerHash = s.owner_user_id
      ? createHash("sha256").update(String(s.owner_user_id)).digest("hex")
      : null;
    await q(
      tx,
      `insert into reports (share_id, evidence, reason, details, reporter_anon_id, reporter_user_id, reporter_email, ip_hmac)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        shareId,
        JSON.stringify({
          targetType: s.target_type,
          versionId: s.version_id ?? null,
          ownerHash,
          objectPaths: [],
        }),
        b.reason,
        b.details ?? null,
        reporter,
        user?.id ?? null,
        b.email ?? null,
        ipHmac(c),
      ],
    );
  });
}

export async function createRightsRequest(
  c: Ctx,
  d: Deps,
  body: unknown,
): Promise<{ requestId: string; dueAt: string }> {
  const b = parsed(RightsRequestReqSchema.safeParse(body));
  turnstile(b.turnstileToken);
  const now = nowOf(d);
  const due = new Date(now.getTime() + (DUE_HOURS[b.type] ?? 24) * 3600_000);
  const privacy = b.type === "privacy_request";
  // 본인 확인 토큰은 해시만 저장(원문은 메일로만, M7 메일 배선)
  const token = privacy ? randomBytes(32).toString("base64url") : null;
  const r = await d.db.withService((tx) =>
    q(
      tx,
      `insert into rights_requests (type, domain, target_url, requester_email, requester_role, details, status,
         verify_token_hash, verify_expires_at, received_at, due_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        b.type,
        b.domain ?? null,
        b.targetUrl ?? null,
        b.requesterEmail,
        b.requesterRole,
        b.details,
        privacy ? "awaiting_verification" : "received",
        token ? createHash("sha256").update(token).digest("hex") : null,
        token ? new Date(now.getTime() + VERIFY_TTL_H * 3600_000).toISOString() : null,
        now.toISOString(),
        due.toISOString(),
      ],
    ),
  );
  return { requestId: String(r.rows[0]?.id), dueAt: due.toISOString() };
}
