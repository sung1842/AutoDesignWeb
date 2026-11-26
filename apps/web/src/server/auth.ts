// 06장 6.5 인증·세션 귀속(M5, ASM-103·ASM-104). 매직링크 요청·로그아웃은 서버 함수(S04·헤더 서버 액션이 호출),
// 콜백·/api/me·/api/consents는 handle 라우트.
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { ConsentReqSchema, MagicLinkReqSchema, type MagicLinkReq } from "@tastefit/api-contract";
import { isAuthError, SESSION_COOKIE, SESSION_TTL_S, type AuthUser } from "@tastefit/auth";
import { q, type Tx } from "@tastefit/db";
import type { Deps } from "./api";
import { serverEvent } from "./events";
import { anonCookie, ApiError, ensureAnon, parsed, readCookie, redirect, type Ctx } from "./http";
import { currentSeason } from "./survey";

/**
 * 현재 시행 문서 버전(08장 8.7.4 C: doc_version = 문서 시행일). legal/*.md 확정 전 임시값(ASM-104 ③).
 * 필수 = age_14(C1)·terms(C2). privacy_notice(N1)는 노출 기록.
 */
export const CURRENT_DOC_VERSIONS = {
  terms: "2026-11-16",
  age_14: "2026-11-16",
  privacy_notice: "2026-11-16",
} as const;
const REQUIRED_DOCS = ["age_14", "terms"] as const;

export const sessionCookie = (v: string): string =>
  `${SESSION_COOKIE}=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_S}`;
const clearSession = `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

/** 6.5.3 next는 동일 오리진 경로만. 아니면 /me. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\0\r\n]/.test(next))
    return "/me";
  try {
    const u = new URL(next, "http://x.invalid");
    return u.origin === "http://x.invalid" ? `${u.pathname}${u.search}` : "/me";
  } catch {
    return "/me";
  }
}

// CONSENT_HASH_KEY가 없으면(로컬 테스트) 프로세스별 임시 키. local 밖에서는 env 검증이 막는다(6.13.1).
const FALLBACK_HASH_KEY = randomBytes(32).toString("base64url");
function hashKey(d: Deps): string {
  return d.consentHashKey ?? process.env.CONSENT_HASH_KEY ?? FALLBACK_HASH_KEY;
}
/** 6.5.4 p_email_hash = HMAC-SHA256(lower(trim(email)), CONSENT_HASH_KEY). */
export const emailHash = (email: string, key: string): string =>
  createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
/** 6.5.4 요청 시점 ADMIN_EMAILS(쉼표 구분, 소문자·trim). */
function isAdminEmail(d: Deps, email: string): boolean {
  const list = (d.adminEmails ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

function authOf(d: Deps) {
  if (!d.auth) throw new ApiError("INTERNAL", "auth driver not configured");
  return d.auth;
}

/** 로그인 사용자(세션 쿠키) 또는 401. */
export async function requireUser(c: Ctx, d: Deps): Promise<AuthUser> {
  const u = c.session ? await authOf(d).getUser(c.session) : null;
  if (!u) throw new ApiError("UNAUTHORIZED", "login required");
  return u;
}

/** consent 인증(6.4.1 표): 로그인 + 현재 버전 terms·age_14. 아니면 401·403 CONSENT_REQUIRED(details.docTypes). */
export async function requireConsent(c: Ctx, d: Deps): Promise<AuthUser> {
  const u = await requireUser(c, d);
  const missing = await d.db.withService((tx) => missingConsents(tx, u.id));
  if (missing.length)
    throw new ApiError("CONSENT_REQUIRED", "consent required", { docTypes: missing });
  return u;
}

/** 현재 버전 terms·age_14 agreed=true가 모두 있는지(8.7.4 C). 없는 doc_type 목록. */
export async function missingConsents(tx: Tx, uid: string): Promise<string[]> {
  const r = await q(
    tx,
    `select distinct doc_type from consents
      where user_id = $1 and agreed and ((doc_type = 'terms' and doc_version = $2) or (doc_type = 'age_14' and doc_version = $3))`,
    [uid, CURRENT_DOC_VERSIONS.terms, CURRENT_DOC_VERSIONS.age_14],
  );
  const have = new Set(r.rows.map((x) => String(x.doc_type)));
  return REQUIRED_DOCS.filter((t) => !have.has(t));
}

/** 6.5.3 attach_anon. 반환 = diagnosis_sessions 갱신 행 수. */
export async function attachAnon(tx: Tx, uid: string, anonId: string): Promise<number> {
  await q(
    tx,
    "insert into identity_links (anon_id, user_id) values ($1, $2) on conflict do nothing",
    [anonId, uid],
  );
  const s = await q(
    tx,
    "update diagnosis_sessions set user_id = $1 where anon_id = $2 and user_id is null",
    [uid, anonId],
  );
  await q(
    tx,
    "update brief_drafts set user_id = $1 where anon_id = $2 and user_id is null and expires_at > now()",
    [uid, anonId],
  );
  await q(
    tx,
    "update share_links set owner_user_id = $1 where owner_anon_id = $2 and owner_user_id is null",
    [uid, anonId],
  );
  return s.rowCount;
}

/** S04 서버 액션: 매직링크 요청. Turnstile local 드라이버 = 형식만(빈 문자열 실패, 6.13.1). */
export async function requestMagicLink(d: Deps, input: MagicLinkReq): Promise<void> {
  const b = parsed(MagicLinkReqSchema.safeParse(input));
  if (!b.turnstileToken.trim()) throw new ApiError("TURNSTILE_FAILED", "turnstile");
  await authOf(d).issueMagicLink(b.email, safeNext(b.next));
}

/** GET /auth/callback?token=&next= → 세션 쿠키 → provision_user → attach_anon → 302. */
export async function callback(c: Ctx, d: Deps): Promise<Response> {
  const next = safeNext(c.url.searchParams.get("next"));
  let ex;
  try {
    ex = await authOf(d).exchange(c.url.searchParams);
  } catch (e) {
    if (isAuthError(e)) return redirect(c, "/login?error=CLIENT_LINK_EXPIRED");
    throw e;
  }
  const { id, email } = ex.user;
  const anon = ensureAnon(c);
  const missing = await d.db.withService(async (tx) => {
    const before = await q(tx, "select 1 from users where id = $1", [id]);
    await q(tx, "select provision_user($1, $2, $3)", [
      id,
      isAdminEmail(d, email),
      emailHash(email, hashKey(d)),
    ]);
    const merged = await attachAnon(tx, id, anon);
    await serverEvent(tx, {
      name: "login_success",
      anonId: anon,
      userId: id,
      tv: await currentSeason(tx),
      props: { provider: "email", is_new_user: before.rowCount === 0, merged_anon: merged > 0 },
    });
    return missingConsents(tx, id);
  });
  c.cookies.push(sessionCookie(ex.session));
  return redirect(
    c,
    missing.length ? `/onboarding/consent?next=${encodeURIComponent(next)}` : next,
  );
}

/** 헤더 서버 액션: 로그아웃. 세션 폐기 + anon_id 재발급(6.5.2). 응답에 붙일 Set-Cookie 헤더. */
export async function logout(d: Deps, req: Request): Promise<Headers> {
  const s = readCookie(req, SESSION_COOKIE);
  if (s) await authOf(d).signOut(s);
  const h = new Headers();
  h.append("set-cookie", clearSession);
  h.append("set-cookie", anonCookie(randomUUID()));
  return h;
}

/** GET /api/me(6.4.3 MeView 중 M5-02 범위: id·email·role·consentsOk·inviteOk). */
export async function me(c: Ctx, d: Deps): Promise<Record<string, unknown>> {
  const u = await requireUser(c, d);
  return d.db.withService(async (tx) => {
    const r = await q(tx, "select role from users where id = $1", [u.id]);
    if (r.rowCount === 0) throw new ApiError("UNAUTHORIZED", "no user");
    const missing = await missingConsents(tx, u.id);
    const inv =
      process.env.BETA_INVITE_ONLY === "true"
        ? (await q(tx, "select 1 from invite_redemptions where user_id = $1 limit 1", [u.id]))
            .rowCount > 0
        : true;
    return {
      id: u.id,
      email: u.email,
      role: String(r.rows[0]?.role ?? "user"),
      consentsOk: missing.length === 0,
      inviteOk: inv,
    };
  });
}

/** POST /api/consents: C1·C2 필수(현재 버전, agreed=true). 아니면 400. */
export async function saveConsents(c: Ctx, d: Deps, body: unknown): Promise<void> {
  const u = await requireUser(c, d);
  const b = parsed(ConsentReqSchema.safeParse(body));
  const cur = CURRENT_DOC_VERSIONS as Record<string, string>;
  const missing = REQUIRED_DOCS.filter(
    (t) => !b.items.some((i) => i.docType === t && i.agreed && i.docVersion === cur[t]),
  );
  if (missing.length)
    throw new ApiError("VALIDATION_FAILED", "required consent missing", {
      issues: missing.map((t) => ({ path: `items.${t}`, code: "required_consent" })),
    });
  await d.db.withService(async (tx) => {
    for (const i of b.items)
      await q(
        tx,
        `insert into consents (user_id, doc_type, doc_version, agreed, shown_at, agreed_at)
         values ($1, $2, $3, $4, now(), case when $4 then now() end)`,
        [u.id, i.docType, i.docVersion, i.agreed],
      );
  });
}
