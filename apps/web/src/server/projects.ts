// 06장 6.4.3 POST /api/projects(consent): 6.4.5 ①~⑦, 임시본 제출(consumed_at), 레퍼런스명 일치 증빙(08장 8.9.2, ASM-108 ⑤).
import { createHash } from "node:crypto";
import { ProjectCreateReqSchema } from "@tastefit/api-contract";
import { normalizeAbuse } from "@tastefit/compliance";
import { q, type Tx } from "@tastefit/db";
import type { Deps } from "./api";
import { requireConsent } from "./auth";
import { processBrand } from "./brief";
import { ApiError, parsed, type Ctx } from "./http";

/** 06장 6.4.2 PROJECT_LIMIT. */
export const PROJECT_LIMIT = 10;
const AXES = ["expression", "temperature", "shape", "density", "depth"] as const;

export const brandHash = (name: string): string =>
  createHash("sha256").update(normalizeAbuse(name)).digest("hex");

/** diagnosis_results.profile → projects.taste_snapshot(04장 TasteResult + taxonomy_version·anchor_override). */
async function tasteSnapshot(tx: Tx, resultId: string, uid: string, anon: string | null) {
  const r = await q(
    tx,
    `select r.taxonomy_version, r.type_id, r.anchor_override_type_id, r.profile
       from diagnosis_results r join diagnosis_sessions s on s.id = r.session_id
      where r.id = $1 and (s.user_id = $2 or (s.anon_id = $3 and $3 is not null))`,
    [resultId, uid, anon],
  );
  const row = r.rows[0];
  if (!row) throw new ApiError("NOT_FOUND", "no result");
  const p = (row.profile ?? {}) as {
    kappa?: number;
    axes?: { key: string; mu: number; sigma: number; state: string }[];
  };
  const ax = new Map((p.axes ?? []).map((a) => [a.key, a]));
  const vec = (f: "mu" | "sigma") => Object.fromEntries(AXES.map((k) => [k, ax.get(k)?.[f] ?? 0]));
  return {
    taxonomy_version: String(row.taxonomy_version),
    mu: vec("mu"),
    sigma: vec("sigma"),
    kappa: p.kappa ?? 0,
    insensitive_axes: AXES.filter((k) => ax.get(k)?.state === "insensitive"),
    type_id: String(row.type_id),
    anchor_override_type_id: (row.anchor_override_type_id as string | null) ?? null,
  };
}

/** 8.9.2 레퍼런스 사이트명 일치(title·title_ko·도메인 첫 라벨, 정규화 비교). */
async function matchesReference(tx: Tx, name: string): Promise<boolean> {
  const n = normalizeAbuse(name);
  if (!n) return false;
  const r = await q(tx, "select title, title_ko, domain from reference_sites");
  return r.rows.some((x) =>
    [x.title, x.title_ko, String(x.domain ?? "").split(".")[0]]
      .filter((v): v is string => typeof v === "string" && v !== "")
      .some((v) => normalizeAbuse(v) === n),
  );
}

export async function createProject(
  c: Ctx,
  d: Deps,
  body: unknown,
): Promise<Record<string, unknown>> {
  const u = await requireConsent(c, d);
  const b = parsed(ProjectCreateReqSchema.safeParse(body));
  const now = (d.now?.() ?? new Date()).toISOString();
  const out = await d.db.withService(async (tx) => {
    const st = await q(tx, "select status from users where id = $1", [u.id]);
    if (st.rows[0]?.status !== "active" && st.rows[0]?.status !== "gen_suspended")
      throw new ApiError("ACCOUNT_SUSPENDED", "account suspended");
    const taste = await tasteSnapshot(tx, b.resultId, u.id, c.anonId);
    const cnt = await q(tx, "select count(*)::int as n from projects where owner_id = $1", [u.id]);
    if (Number(cnt.rows[0]?.n) >= PROJECT_LIMIT)
      throw new ApiError("PROJECT_LIMIT", "project limit", { limit: PROJECT_LIMIT });
    let processed;
    try {
      processed = await processBrand(tx, b.purpose, b.brand);
    } catch (e) {
      if (e instanceof ApiError && e.code === "BLOCKED_BRAND") return { blocked: e };
      throw e;
    }
    const { brand, masked } = processed;
    const hash = brandHash(brand.name);
    if (await matchesReference(tx, brand.name)) {
      if (b.brandAttested !== true)
        throw new ApiError("BRAND_ATTESTATION_REQUIRED", "brand attestation required");
      await q(
        tx,
        `insert into consents (user_id, doc_type, doc_version, agreed, shown_at, agreed_at, subject_ref)
         values ($1, 'brand_attestation', $2, true, $3, $3, $4)`,
        [u.id, now.slice(0, 10), now, hash],
      );
    }
    if (b.briefDraftId) {
      const dr = await q(
        tx,
        `update brief_drafts set consumed_at = $3
          where id = $1 and (user_id = $2 or (anon_id::text = $4 and $4 is not null))
            and consumed_at is null and expires_at > $3
          returning id`,
        [b.briefDraftId, u.id, now, c.anonId],
      );
      if (dr.rowCount === 0) throw new ApiError("NOT_FOUND", "no draft");
    }
    const r = await q(
      tx,
      `insert into projects (owner_id, result_id, taste_snapshot, purpose, brand, brand_hash, use_sample_content, brief_draft_id, title)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        u.id,
        b.resultId,
        JSON.stringify(taste),
        b.purpose,
        JSON.stringify(brand),
        hash,
        b.useSampleContent,
        b.briefDraftId ?? null,
        Array.from(brand.name).slice(0, 60).join(""),
      ],
    );
    return { view: { projectId: String(r.rows[0]?.id), maskedFields: masked } };
  });
  if ("blocked" in out) throw out.blocked;
  return out.view;
}
