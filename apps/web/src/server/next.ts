// Next 라우트 파일 공용: env에서 Deps를 한 번 만들고 handle에 위임(ASM-095 ①).
import { createLocalAuth } from "@tastefit/auth";
import { createDbPort, webConnectionString } from "@tastefit/db";
import { createFsStorage } from "@tastefit/storage";
import { serverEnv } from "../server-env";
import { handle, type Deps } from "./api";

let D: Deps | null = null;
function deps(): Deps {
  if (D) return D;
  const v = serverEnv().values;
  const fs = v.APP_ENV === "local" && v.STORAGE_DRIVER === "fs";
  const db = createDbPort(webConnectionString(v));
  // native 프로파일: AuthPort local(6.13.1). supabase 드라이버는 needs_ci(ASM-104 ⑤)
  D = {
    db,
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
