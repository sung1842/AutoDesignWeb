// preview 호스트(06장 6.11.4, ASM-027 ⑥, ASM-059). Next 라우트는 이 함수들을 얇게 감싼다.
// 서명 URL: sig = HMAC-SHA256(PREVIEW_SIGNING_SECRET, kind|id|vp|exp), exp ≤ 발급 + 15분.
import { createHmac, timingSafeEqual } from "node:crypto";
import { compilePage } from "@tastefit/renderer";

export type PreviewKind = "candidate" | "version" | "share";
export interface PreviewDeps {
  env: {
    WEB_ORIGIN: string;
    PREVIEW_ORIGIN: string;
    PREVIEW_SIGNING_SECRET: string;
    APP_ENV: string;
  };
  now: () => number;
  loadCandidate: (id: string) => Promise<{ ownerId: string; spec: unknown; tree: unknown } | null>;
  data: unknown;
}

/** 6.11.4 서명 유효 기간(발급 + 15분 이하). 발급은 10분으로 둔다. */
export const PREVIEW_TTL_SEC = 600;
const KINDS: readonly PreviewKind[] = ["candidate", "version", "share"];

export function signPreview(
  secret: string,
  kind: PreviewKind,
  id: string,
  vp: number,
  exp: number,
): string {
  return createHmac("sha256", secret).update(`${kind}|${id}|${vp}|${exp}`).digest("hex");
}

/** 6.11.4 preview 호스트 응답 헤더(문자열 그대로, TC-S-07). */
export function previewHeaders(env: PreviewDeps["env"]): Record<string, string> {
  return {
    "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; img-src ${env.PREVIEW_ORIGIN} data:; font-src ${env.PREVIEW_ORIGIN}; base-uri 'none'; form-action 'none'; frame-ancestors ${env.WEB_ORIGIN}; sandbox`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "cross-origin",
    "cache-control": "private, max-age=300",
    "x-robots-tag": "noindex, nofollow",
  };
}

const deny = (status: number): Response =>
  new Response("", { status, headers: { "cache-control": "no-store" } });

function sigOk(
  secret: string,
  kind: PreviewKind,
  id: string,
  vp: number,
  exp: number,
  sig: string,
): boolean {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const want = Buffer.from(signPreview(secret, kind, id, vp, exp), "hex");
  return timingSafeEqual(want, Buffer.from(sig, "hex"));
}

/** GET {PREVIEW_ORIGIN}/render/{kind}/{id}?vp&exp&sig. share는 공개 링크 확인(M6)이라 여기서는 candidate·version만. */
export async function handlePreview(req: Request, deps: PreviewDeps): Promise<Response> {
  const url = new URL(req.url);
  // 6.13.1 native 기동 확인(AC-06-59 ⑥): 200 "ok", 미리보기 보안 헤더는 그대로
  if (url.pathname === "/healthz" && req.method === "GET")
    return new Response("ok", {
      status: 200,
      headers: { ...previewHeaders(deps.env), "content-type": "text/plain" },
    });
  const m = /^\/render\/(candidate|version|share)\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
  if (!m || req.method !== "GET") return deny(404);
  const kind = m[1] as PreviewKind;
  const id = m[2] ?? "";
  const vp = Number(url.searchParams.get("vp"));
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!KINDS.includes(kind) || kind === "share") return deny(404);
  if (!Number.isInteger(vp) || !Number.isInteger(exp)) return deny(403);
  const nowSec = Math.floor(deps.now() / 1000);
  if (exp <= nowSec || exp > nowSec + 15 * 60) return deny(403);
  if (!sigOk(deps.env.PREVIEW_SIGNING_SECRET, kind, id, vp, exp, sig)) return deny(403);
  const c = await deps.loadCandidate(id);
  if (!c) return deny(404);
  const { html } = compilePage(c.spec, c.tree, deps.data);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...previewHeaders(deps.env) },
  });
}

/** 서명 URL 발급(서비스 쪽). 소유자가 아니면 404(존재 노출 금지). */
export async function issuePreviewUrl(
  input: { userId: string; kind: PreviewKind; id: string; vp: number },
  deps: PreviewDeps,
): Promise<{ status: number; url?: string }> {
  if (input.kind === "share") return { status: 404 };
  const c = await deps.loadCandidate(input.id);
  if (!c || c.ownerId !== input.userId) return { status: 404 };
  const exp = Math.floor(deps.now() / 1000) + PREVIEW_TTL_SEC;
  const sig = signPreview(deps.env.PREVIEW_SIGNING_SECRET, input.kind, input.id, input.vp, exp);
  const u = new URL(
    `/render/${input.kind}/${encodeURIComponent(input.id)}`,
    deps.env.PREVIEW_ORIGIN,
  );
  u.searchParams.set("vp", String(input.vp));
  u.searchParams.set("exp", String(exp));
  u.searchParams.set("sig", sig);
  return { status: 200, url: u.toString() };
}

const attr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 6.11.4 iframe: 표시 = sandbox=""(src), 측정 = sandbox="allow-same-origin"(srcdoc, 화면 밖). allow-scripts 없음. */
export function previewFrame(input: {
  kind: "display" | "measure";
  src?: string;
  srcdoc?: string;
  title?: string;
  width?: number;
}): string {
  const w = input.width ?? 1280;
  if (input.kind === "display")
    return `<iframe src="${attr(input.src ?? "")}" sandbox="" referrerpolicy="no-referrer" loading="lazy" title="${attr(input.title ?? "시안 미리보기")}" width="${w}" style="border:0"></iframe>`;
  return `<iframe srcdoc="${attr(input.srcdoc ?? "")}" sandbox="allow-same-origin" aria-hidden="true" tabindex="-1" width="${w}" style="position:fixed;left:-10000px;border:0"></iframe>`;
}
