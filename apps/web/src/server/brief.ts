// 01장 1.5.5.5 브리프 임시본(D-0620, R-26): POST /api/brief-drafts(06장 6.4.5 ①~⑤), GET /api/brief-drafts/:id.
import { createHash } from "node:crypto";
import { BriefDraftReqSchema, validateBrand, type BrandInput } from "@tastefit/api-contract";
import { judgeBrief, maskPII, normalizeAbuse, type PiiCounts } from "@tastefit/compliance";
import { q, type Tx } from "@tastefit/db";
import type { Deps } from "./api";
import { ApiError, ensureAnon, parsed, type Ctx } from "./http";

/** 로그인 사용자 id(선택). 인증 드라이버가 없거나 세션이 무효면 null. */
async function optionalUid(c: Ctx, d: Deps): Promise<string | null> {
  if (!c.session || !d.auth) return null;
  return (await d.auth.getUser(c.session))?.id ?? null;
}

/** 6.4.5 ①~⑤ 공통(brief-drafts·projects). 통과하면 마스킹된 brand와 종류별 건수. */
export async function processBrand(
  tx: Tx,
  purpose: Parameters<typeof validateBrand>[0],
  raw: Parameters<typeof validateBrand>[1],
): Promise<{ brand: BrandInput; masked: PiiCounts }> {
  const v = validateBrand(purpose, raw);
  if (!v.ok)
    throw new ApiError("VALIDATION_FAILED", "brand validation failed", { issues: v.issues });
  const { value: brand, counts } = maskPII(v.brand);
  const hit = judgeBrief(brand);
  if (hit) {
    // 8.9.2 거부 기록: 입력값은 정규화 SHA-256만(ASM-105 ④). 응답이 422여도 감사 행은 남아야 하므로 호출자가 커밋한다
    await q(
      tx,
      "insert into admin_audit_logs (action, target_type, target_id, after) values ('brand_blocked', 'brief', $1, $2)",
      [
        createHash("sha256").update(normalizeAbuse(brand.name)).digest("hex"),
        JSON.stringify({ reason: hit.reason, ref: hit.ref }),
      ],
    );
    throw new ApiError("BLOCKED_BRAND", "blocked brand", { reason: hit.reason });
  }
  return { brand, masked: counts };
}

/** 결과 소유: 그 결과의 진단 세션이 이 anon 쿠키 또는 로그인 사용자 것. */
async function ownsResult(tx: Tx, resultId: string, anon: string | null, uid: string | null) {
  const r = await q(
    tx,
    `select 1 from diagnosis_results r join diagnosis_sessions s on s.id = r.session_id
      where r.id = $1 and ((s.anon_id = $2 and $2 is not null) or (s.user_id = $3 and $3 is not null))`,
    [resultId, anon, uid],
  );
  return r.rowCount > 0;
}

export async function createBriefDraft(
  c: Ctx,
  d: Deps,
  body: unknown,
): Promise<Record<string, unknown>> {
  const b = parsed(BriefDraftReqSchema.safeParse(body));
  const anon = ensureAnon(c);
  const uid = await optionalUid(c, d);
  // 감사 행(거부)은 커밋, 거부 응답은 트랜잭션 밖에서 던진다
  const out = await d.db.withService(async (tx) => {
    if (!(await ownsResult(tx, b.resultId, anon, uid)))
      throw new ApiError("NOT_FOUND", "no result");
    try {
      const { brand, masked } = await processBrand(tx, b.purpose, b.brand);
      const r = await q(
        tx,
        `insert into brief_drafts (anon_id, user_id, result_id, purpose, brand, use_sample_content)
         values ($1, $2, $3, $4, $5, $6) returning id, expires_at`,
        [anon, uid, b.resultId, b.purpose, JSON.stringify(brand), b.useSampleContent],
      );
      return {
        ok: true as const,
        view: {
          briefDraftId: String(r.rows[0]?.id),
          expiresAt: new Date(String(r.rows[0]?.expires_at)).toISOString(),
          maskedFields: masked,
        },
      };
    } catch (e) {
      if (e instanceof ApiError && e.code === "BLOCKED_BRAND") return { ok: false as const, e };
      throw e;
    }
  });
  if (!out.ok) throw out.e;
  return out.view;
}

export async function getBriefDraft(c: Ctx, d: Deps, id: string): Promise<Record<string, unknown>> {
  const uid = await optionalUid(c, d);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError("NOT_FOUND", "no draft");
  return d.db.withService(async (tx) => {
    const r = await q(
      tx,
      `select id, result_id, purpose, brand, use_sample_content, expires_at, expires_at <= $4 as expired
         from brief_drafts
        where id = $1 and ((anon_id::text = $2 and $2 is not null) or (user_id = $3 and $3 is not null))`,
      [id, c.anonId, uid, (d.now?.() ?? new Date()).toISOString()],
    );
    const row = r.rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "no draft");
    if (row.expired === true) throw new ApiError("DRAFT_EXPIRED", "draft expired");
    return {
      briefDraftId: String(row.id),
      resultId: String(row.result_id),
      purpose: String(row.purpose),
      brand: row.brand,
      useSampleContent: row.use_sample_content === true,
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    };
  });
}
