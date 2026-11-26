// AuthPort(06장 6.13.1, T-11 ⑤) + local 드라이버(ASM-103·ASM-104). 서버 전용.
// local: 매직링크를 발송하지 않고 dev_mail_outbox에 기록, 링크는 실제와 같은 /auth/callback.
//   링크 토큰 = HS256 {email, jti, exp(1h)}. 사용한 jti는 shim auth.audit_log_entries(action='magiclink_used')로 재사용 거부.
//   세션 = HS256 {sub, role, aal, sid, exp}. sid = shim auth.sessions 행, signOut·adminSignOutAll = not_after = now().
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { q, type Aal, type DbPort } from "@tastefit/db";
import { createLocalMail, type MailPort } from "@tastefit/mail";

export const PACKAGE_NAME = "@tastefit/auth";

/** 매직링크 유효 시간(6.5.2: 1시간, 1회용). */
export const MAGIC_LINK_TTL_S = 3600;
/** local 세션 JWT 수명. 실제 유효성은 auth.sessions.not_after가 결정한다(ASM-104). */
export const SESSION_TTL_S = 2_592_000;
/** 세션 쿠키 이름(ASM-103 ④). */
export const SESSION_COOKIE = "tf_session";

export interface AuthUser {
  id: string;
  email: string;
  aal: Aal;
}
export interface Exchanged {
  user: { id: string; email: string };
  /** 세션 쿠키 값. */
  session: string;
  /** auth.users 행을 이번에 만들었는지. */
  isNewAuthUser: boolean;
}
export type AuthErrorCode = "LINK_EXPIRED" | "LINK_INVALID";
export class AuthError extends Error {
  override readonly name = "AuthError";
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}
/** src·dist 두 모듈 인스턴스가 섞여도(테스트) 판정되도록 instanceof 대신 이름으로 본다. */
export const isAuthError = (e: unknown): e is AuthError =>
  e instanceof Error && e.name === "AuthError";

export interface AuthPort {
  /** 매직링크 발급. next는 호출자가 동일 오리진 경로로 정규화해 넘긴다. */
  issueMagicLink(email: string, next: string): Promise<void>;
  /** 콜백 파라미터(local: token, supabase: code) → 세션. 실패는 AuthError. */
  exchange(params: URLSearchParams): Promise<Exchanged>;
  /** 세션 쿠키 값 → 사용자. 무효·폐기·만료면 null. */
  getUser(session: string): Promise<AuthUser | null>;
  signOut(session: string): Promise<void>;
  adminSignOutAll(uid: string): Promise<void>;
  adminDeleteUser(uid: string): Promise<void>;
}

// ---- HS256(JWS compact) ----
const b64 = (b: Buffer | string): string => Buffer.from(b).toString("base64url");
const HEADER = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
function sign(secret: string, payload: Record<string, unknown>): string {
  const body = `${HEADER}.${b64(JSON.stringify(payload))}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
/** 서명·형식이 맞으면 payload, 아니면 null. exp는 호출자가 본다. */
export function verifyJwt(secret: string, token: string): Record<string, unknown> | null {
  const [h, p, s, extra] = token.split(".");
  if (!h || !p || !s || extra !== undefined || h !== HEADER) return null;
  const want = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const v: unknown = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const nowS = (): number => Math.floor(Date.now() / 1000);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export interface LocalAuthOptions {
  db: DbPort;
  /** LOCAL_JWT_SECRET */
  secret: string;
  webOrigin: string;
  mail?: MailPort;
}

export function createLocalAuth(o: LocalAuthOptions): AuthPort {
  // LOCAL_JWT_SECRET 길이는 env 스키마(secret32, @tastefit/config)가 검사한다
  if (!o.secret) throw new Error("auth local: LOCAL_JWT_SECRET 없음");
  const mail = o.mail ?? createLocalMail(o.db);
  const origin = new URL(o.webOrigin).origin;

  return {
    async issueMagicLink(email, next) {
      const addr = email.trim().toLowerCase();
      const token = sign(o.secret, {
        typ: "magiclink",
        email: addr,
        jti: randomUUID(),
        exp: nowS() + MAGIC_LINK_TTL_S,
      });
      const u = new URL("/auth/callback", origin);
      u.searchParams.set("token", token);
      u.searchParams.set("next", next);
      await mail.send("magic_link", addr, { link: u.toString() });
    },

    async exchange(params) {
      const p = verifyJwt(o.secret, params.get("token") ?? "");
      const email = str(p?.email);
      const jti = str(p?.jti);
      if (!p || p.typ !== "magiclink" || !email || !jti) throw new AuthError("LINK_INVALID");
      if (typeof p.exp !== "number" || p.exp <= nowS()) throw new AuthError("LINK_EXPIRED");
      return o.db.withService(async (tx) => {
        // 1회용: jti 기록이 이미 있으면 거부(동시 사용은 advisory lock으로 직렬화)
        await q(tx, "select pg_advisory_xact_lock(hashtext($1))", [jti]);
        const used = await q(
          tx,
          "select 1 from auth.audit_log_entries where payload->>'action' = 'magiclink_used' and payload->>'jti' = $1",
          [jti],
        );
        if (used.rowCount > 0) throw new AuthError("LINK_EXPIRED");
        await q(tx, "insert into auth.audit_log_entries (payload) values ($1)", [
          JSON.stringify({ action: "magiclink_used", jti }),
        ]);
        const found = await q(tx, "select id from auth.users where lower(email) = $1 limit 1", [
          email,
        ]);
        let id = str(found.rows[0]?.id);
        const isNewAuthUser = !id;
        if (!id) {
          id = randomUUID();
          await q(tx, "insert into auth.users (id, email) values ($1, $2)", [id, email]);
        }
        const sid = randomUUID();
        await q(tx, "insert into auth.sessions (id, user_id) values ($1, $2)", [sid, id]);
        const session = sign(o.secret, {
          typ: "session",
          sub: id,
          role: "authenticated",
          aal: "aal1",
          sid,
          exp: nowS() + SESSION_TTL_S,
        });
        return { user: { id, email }, session, isNewAuthUser };
      });
    },

    async getUser(session) {
      const p = verifyJwt(o.secret, session);
      const sub = str(p?.sub);
      const sid = str(p?.sid);
      if (!p || p.typ !== "session" || !sub || !sid) return null;
      if (typeof p.exp !== "number" || p.exp <= nowS()) return null;
      const aal: Aal = p.aal === "aal2" ? "aal2" : "aal1";
      const r = await o.db.withService((tx) =>
        q(
          tx,
          `select u.email from auth.sessions s join auth.users u on u.id = s.user_id
            where s.id = $1 and s.user_id = $2 and (s.not_after is null or s.not_after > now())`,
          [sid, sub],
        ),
      );
      const email = str(r.rows[0]?.email);
      return email ? { id: sub, email, aal } : null;
    },

    async signOut(session) {
      const p = verifyJwt(o.secret, session);
      const sid = str(p?.sid);
      if (!sid) return;
      await o.db.withService((tx) =>
        q(tx, "update auth.sessions set not_after = now(), updated_at = now() where id = $1", [
          sid,
        ]),
      );
    },

    async adminSignOutAll(uid) {
      await o.db.withService((tx) =>
        q(
          tx,
          "update auth.sessions set not_after = now(), updated_at = now() where user_id = $1 and (not_after is null or not_after > now())",
          [uid],
        ),
      );
    },

    async adminDeleteUser(uid) {
      await o.db.withService((tx) => q(tx, "delete from auth.users where id = $1", [uid]));
    },
  };
}
