// API 진입점(ASM-095 ①): Next 라우트 파일은 handle(req, deps)에 위임만 한다. 표준 Fetch Request/Response.
import { createRightsRequest, createShare, reportShare } from "./share";
import {
  AnchorOverrideReqSchema,
  RatingReqSchema,
  StartSurveyReqSchema,
  SubmitAnswerReqSchema,
  UndoReqSchema,
} from "@tastefit/api-contract";
import type { AuthPort } from "@tastefit/auth";
import type { DbPort } from "@tastefit/db";
import { PUBLIC_BUCKETS, type StoragePort } from "@tastefit/storage";
import { callback, me, saveConsents } from "./auth";
import { createBriefDraft, getBriefDraft } from "./brief";
import { cancelGeneration, createGeneration, getGeneration } from "./generations";
import { redeemInvite } from "./invites";
import { createProject } from "./projects";
import { clientEvents } from "./events";
import {
  ApiError,
  checkCsrf,
  ensureAnon,
  errorResponse,
  json,
  makeCtx,
  noContent,
  accepted,
  parsed,
  readJson,
  type Ctx,
} from "./http";
import {
  activeItems,
  anchorOverride,
  currentSeason,
  currentSurvey,
  deleteSurvey,
  rate,
  resultView,
  startSurvey,
  submitAnswer,
  surveyItemsView,
  undo,
} from "./survey";

export interface Deps {
  db: DbPort;
  webOrigin: string;
  /** fs 드라이버 저장소(06장 6.13.1). APP_ENV=local·STORAGE_DRIVER=fs일 때만 /api/_storage가 응답한다. */
  storage?: StoragePort | null;
  /** AuthPort(6.13.1). 인증 라우트(M5)에서만 필요. */
  auth?: AuthPort;
  /** 요청 시점 ADMIN_EMAILS(6.5.4). 없으면 env. */
  adminEmails?: string;
  /** CONSENT_HASH_KEY. 없으면 env. */
  consentHashKey?: string;
  /** 시계(테스트·APP_ENV=local의 RETENTION_NOW, ASM-108 ①). 없으면 현재 시각. */
  now?: () => Date;
}
/** 6.7 공개 정적 데이터 캐시(1년 immutable). */
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

type Route = (c: Ctx, d: Deps, m: RegExpExecArray) => Promise<Response>;
const R: [string, RegExp, Route][] = [
  ["GET", /^\/auth\/callback$/, (c, d) => callback(c, d)],
  [
    "POST",
    /^\/api\/brief-drafts$/,
    async (c, d) => json(c, 201, await createBriefDraft(c, d, await readJson(c))),
  ],
  [
    "GET",
    /^\/api\/brief-drafts\/([^/]+)$/,
    async (c, d, m) => json(c, 200, await getBriefDraft(c, d, m[1] ?? "")),
  ],
  [
    "POST",
    /^\/api\/projects$/,
    async (c, d) => json(c, 201, await createProject(c, d, await readJson(c))),
  ],
  [
    "POST",
    /^\/api\/projects\/([^/]+)\/generations$/,
    (c, d, m) => createGeneration(c, d, m[1] ?? ""),
  ],
  ["GET", /^\/api\/generations\/([^/]+)$/, (c, d, m) => getGeneration(c, d, m[1] ?? "")],
  [
    "POST",
    /^\/api\/generations\/([^/]+)\/cancel$/,
    (c, d, m) => cancelGeneration(c, d, m[1] ?? ""),
  ],
  [
    "POST",
    /^\/api\/invites\/redeem$/,
    async (c, d) => {
      await redeemInvite(c, d, await readJson(c));
      return noContent(c);
    },
  ],
  ["GET", /^\/api\/me$/, async (c, d) => json(c, 200, await me(c, d))],
  [
    "POST",
    /^\/api\/share$/,
    async (c, d) => {
      const r = await createShare(c, d, await readJson(c));
      return json(c, r.status, r.body);
    },
  ],
  [
    "POST",
    /^\/api\/share\/([A-Za-z0-9_-]+)\/report$/,
    async (c, d, m) => {
      await reportShare(c, d, m[1] ?? "", await readJson(c));
      return accepted(c);
    },
  ],
  [
    "POST",
    /^\/api\/rights-requests$/,
    async (c, d) => json(c, 201, await createRightsRequest(c, d, await readJson(c))),
  ],
  [
    "POST",
    /^\/api\/consents$/,
    async (c, d) => {
      await saveConsents(c, d, await readJson(c));
      return noContent(c);
    },
  ],
  [
    "GET",
    /^\/api\/_storage\/public\/([A-Za-z0-9._-]+)\/(.+)$/,
    async (c, d, m) => {
      const [bucket = "", path = ""] = [m[1], m[2]];
      if (!d.storage || !PUBLIC_BUCKETS.has(bucket)) throw new ApiError("NOT_FOUND", "no object");
      const b = await d.storage.get(bucket, decodeURIComponent(path)).catch(() => null);
      if (!b) throw new ApiError("NOT_FOUND", "no object");
      return new Response(new Uint8Array(b), {
        status: 200,
        headers: {
          "content-type": path.endsWith(".webp") ? "image/webp" : "application/octet-stream",
          "cache-control": PUBLIC_CACHE,
        },
      });
    },
  ],
  [
    "GET",
    /^\/api\/survey-items$/,
    async (c, d) => {
      const v = await d.db.withService(async (tx) => {
        const tv = c.url.searchParams.get("taxonomyVersion") ?? (await currentSeason(tx));
        const rows = await activeItems(tx, tv);
        if (rows.length === 0) throw new ApiError("NOT_FOUND", "no items");
        return surveyItemsView(rows, tv, d.webOrigin);
      });
      return json(c, 200, v, { cache: PUBLIC_CACHE });
    },
  ],
  [
    "POST",
    /^\/api\/surveys$/,
    async (c, d) => {
      const b = parsed(StartSurveyReqSchema.safeParse(await readJson(c)));
      const anon = ensureAnon(c);
      const r = await d.db.withService((tx) => startSurvey(tx, anon, b));
      return json(c, r.status, r.view);
    },
  ],
  [
    "GET",
    /^\/api\/surveys\/current$/,
    async (c, d) => json(c, 200, await d.db.withService((tx) => currentSurvey(tx, c.anonId))),
  ],
  [
    "POST",
    /^\/api\/surveys\/([^/]+)\/responses$/,
    async (c, d, m) => {
      const b = parsed(SubmitAnswerReqSchema.safeParse(await readJson(c)));
      return json(
        c,
        200,
        await d.db.withService((tx) => submitAnswer(tx, m[1] ?? "", c.anonId, b)),
      );
    },
  ],
  [
    "POST",
    /^\/api\/surveys\/([^/]+)\/undo$/,
    async (c, d, m) => {
      const b = parsed(UndoReqSchema.safeParse(await readJson(c)));
      return json(
        c,
        200,
        await d.db.withService((tx) => undo(tx, m[1] ?? "", c.anonId, b.fromSeq)),
      );
    },
  ],
  [
    "GET",
    /^\/api\/surveys\/([^/]+)\/result$/,
    async (c, d, m) =>
      json(c, 200, await d.db.withService((tx) => resultView(tx, m[1] ?? "", c.anonId))),
  ],
  [
    "POST",
    /^\/api\/surveys\/([^/]+)\/rating$/,
    async (c, d, m) => {
      const b = parsed(RatingReqSchema.safeParse(await readJson(c)));
      return json(c, 200, await d.db.withService((tx) => rate(tx, m[1] ?? "", c.anonId, b.score)));
    },
  ],
  [
    "PATCH",
    /^\/api\/surveys\/([^/]+)\/anchor-override$/,
    async (c, d, m) => {
      const b = parsed(AnchorOverrideReqSchema.safeParse(await readJson(c)));
      return json(
        c,
        200,
        await d.db.withService((tx) => anchorOverride(tx, m[1] ?? "", c.anonId, b.typeId)),
      );
    },
  ],
  [
    "DELETE",
    /^\/api\/surveys\/([^/]+)$/,
    async (c, d, m) => {
      await d.db.withService((tx) => deleteSurvey(tx, m[1] ?? "", c.anonId));
      return noContent(c);
    },
  ],
  [
    "POST",
    /^\/api\/events$/,
    async (c, d) => {
      const body = await readJson(c);
      const anon = ensureAnon(c);
      await d.db.withService(async (tx) => clientEvents(tx, anon, await currentSeason(tx), body));
      return noContent(c);
    },
  ],
];

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const c = makeCtx(req);
  try {
    checkCsrf(c, deps.webOrigin);
    for (const [method, re, fn] of R) {
      const m = re.exec(c.url.pathname);
      if (m && method === req.method) return await fn(c, deps, m);
    }
    throw new ApiError("NOT_FOUND", "no route");
  } catch (e) {
    return errorResponse(c, e);
  }
}
