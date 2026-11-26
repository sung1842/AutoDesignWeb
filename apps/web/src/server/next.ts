// Next 라우트 파일 공용: env에서 Deps를 한 번 만들고 handle에 위임(ASM-095 ①).
import { createDbPort, webConnectionString } from "@tastefit/db";
import { createFsStorage } from "@tastefit/storage";
import { serverEnv } from "../server-env";
import { handle, type Deps } from "./api";

let D: Deps | null = null;
function deps(): Deps {
  if (D) return D;
  const v = serverEnv().values;
  const fs = v.APP_ENV === "local" && v.STORAGE_DRIVER === "fs";
  D = {
    db: createDbPort(webConnectionString(v)),
    webOrigin: v.WEB_ORIGIN ?? "",
    storage: fs
      ? createFsStorage({ webOrigin: v.WEB_ORIGIN ?? "", secret: v.LOCAL_JWT_SECRET ?? "" })
      : null,
  };
  return D;
}
export const route = (req: Request): Promise<Response> => handle(req, deps());
