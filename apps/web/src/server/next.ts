// Next 라우트 파일 공용: env에서 Deps를 한 번 만들고 handle에 위임(ASM-095 ①).
import { createLocalAuth } from "@tastefit/auth";
import { createDbPort, webConnectionString } from "@tastefit/db";
import { createFsStorage } from "@tastefit/storage";
import { serverEnv } from "../server-env";
import { handle, type Deps } from "./api";

/** APP_ENV=local의 RETENTION_NOW(`+25h`·`+31d`·ISO) → 시계(ASM-108 ①). */
function relNow(raw: string): Date {
  const m = /^\+(\d+)([hd])$/.exec(raw.trim());
  if (m) return new Date(Date.now() + Number(m[1]) * (m[2] === "h" ? 3_600_000 : 86_400_000));
  return new Date(Date.parse(raw));
}
let D: Deps | null = null;
function deps(): Deps {
  if (D) return D;
  const v = serverEnv().values;
  const fs = v.APP_ENV === "local" && v.STORAGE_DRIVER === "fs";
  const db = createDbPort(webConnectionString(v));
  // native 프로파일: AuthPort local(6.13.1). supabase 드라이버는 needs_ci(ASM-104 ⑤)
  const rn = v.APP_ENV === "local" ? process.env.RETENTION_NOW : undefined;
  D = {
    db,
    ...(rn ? { now: () => relNow(rn) } : {}),
    ...(v.LOCAL_JWT_SECRET
      ? {
          auth: createLocalAuth({
            db,
            secret: v.LOCAL_JWT_SECRET,
            webOrigin: v.WEB_ORIGIN ?? "",
          }),
        }
      : {}),
    webOrigin: v.WEB_ORIGIN ?? "",
    storage: fs
      ? createFsStorage({ webOrigin: v.WEB_ORIGIN ?? "", secret: v.LOCAL_JWT_SECRET ?? "" })
      : null,
  };
  return D;
}
export const route = (req: Request): Promise<Response> => handle(req, deps());
/** 서버 액션용 Deps(requestMagicLink·logout). */
export const appDeps = (): Deps => deps();
