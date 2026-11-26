// 06장 6.4.1 공통 규약: JSON 응답·오류 본문·요청 ID·CSRF(Origin + JSON)·anon_id 쿠키(6.5.1).
import { randomUUID } from "node:crypto";
import { ERROR_STATUS, type ErrorCode } from "@tastefit/api-contract";

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** 6.5.1 anon_id 쿠키 속성(30일 = 08장 보관 기간). */
export const ANON_COOKIE = { name: "anon_id", maxAgeS: 2_592_000 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface Ctx {
  req: Request;
  requestId: string;
  url: URL;
  /** 요청 쿠키의 anon_id(없거나 형식이 틀리면 null). */
  anonId: string | null;
  /** 이번 응답에서 새로 발급한 anon_id. */
  issued: string | null;
  /** 요청 쿠키의 세션 값(tf_session, ASM-103 ④). */
  session: string | null;
  /** 응답에 추가할 Set-Cookie(세션 발급·폐기). */
  cookies: string[];
  t0: number;
}

/** 요청 Cookie 헤더에서 이름 하나의 값. */
export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}
/** 6.5.1 anon_id 쿠키 문자열. */
export const anonCookie = (v: string): string =>
  `${ANON_COOKIE.name}=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ANON_COOKIE.maxAgeS}`;

export function makeCtx(req: Request): Ctx {
  const v = readCookie(req, ANON_COOKIE.name);
  return {
    req,
    requestId: req.headers.get("x-request-id") ?? randomUUID(),
    url: new URL(req.url),
    anonId: v && UUID.test(v) ? v : null,
    issued: null,
    session: readCookie(req, "tf_session"),
    cookies: [],
    t0: performance.now(),
  };
}

/** anon 경로: 쿠키가 없으면 발급(미들웨어 아님, 6.5.1). */
export function ensureAnon(c: Ctx): string {
  if (c.anonId) return c.anonId;
  c.issued = randomUUID();
  c.anonId = c.issued;
  return c.issued;
}

/** CSRF(6.4.1): 상태 변경 메서드는 Origin = WEB_ORIGIN 이고 Content-Type JSON. */
export function checkCsrf(c: Ctx, webOrigin: string): void {
  if (c.req.method === "GET" || c.req.method === "HEAD") return;
  const origin = c.req.headers.get("origin");
  const ct = c.req.headers.get("content-type") ?? "";
  if (origin !== new URL(webOrigin).origin || !/^application\/json\b/i.test(ct))
    throw new ApiError("FORBIDDEN_ORIGIN", "origin or content-type mismatch");
}

export async function readJson(c: Ctx): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError("VALIDATION_FAILED", "invalid json", {
      issues: [{ path: "", code: "json" }],
    });
  }
}

/** zod safeParse 결과 → 값 또는 400. */
export function parsed<T>(
  r:
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; code: string }[] } },
): T {
  if (r.success) return r.data;
  throw new ApiError("VALIDATION_FAILED", "validation failed", {
    issues: r.error.issues.map((i) => ({ path: i.path.map(String).join("."), code: i.code })),
  });
}

function finish(c: Ctx, res: Response, opts: { cache?: string } = {}): Response {
  const h = new Headers(res.headers);
  h.set("x-request-id", c.requestId);
  h.set("cache-control", opts.cache ?? "private, no-store");
  h.set("server-timing", `app;dur=${(performance.now() - c.t0).toFixed(1)}`);
  if (c.issued) h.append("set-cookie", anonCookie(c.issued));
  else if (c.anonId && c.url.pathname.startsWith("/api/surveys"))
    // 진단 API 호출마다 만료 연장(6.5.1)
    h.append("set-cookie", anonCookie(c.anonId));
  for (const ck of c.cookies) h.append("set-cookie", ck);
  return new Response(res.body, { status: res.status, headers: h });
}

export function json(
  c: Ctx,
  status: number,
  body: unknown,
  opts: { cache?: string } = {},
): Response {
  return finish(
    c,
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
    opts,
  );
}
export const noContent = (c: Ctx): Response => finish(c, new Response(null, { status: 204 }));
/** 302 리다이렉트(Location은 동일 오리진 경로). */
export const redirect = (c: Ctx, location: string): Response =>
  finish(c, new Response(null, { status: 302, headers: { location } }));

export function errorResponse(c: Ctx, e: unknown): Response {
  const err =
    e instanceof ApiError ? e : new ApiError("INTERNAL", e instanceof Error ? e.message : "error");
  if (!(e instanceof ApiError))
    process.stderr.write(`[api] ${c.requestId} ${String((e as Error)?.stack ?? e)}\n`);
  return json(c, ERROR_STATUS[err.code], {
    error: {
      code: err.code,
      message: err.message,
      requestId: c.requestId,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
