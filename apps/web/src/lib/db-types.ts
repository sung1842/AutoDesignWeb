// db:types 산출(packages/db/src/types.gen.ts)을 web에서 쓰는 지점(09장 9.4.3 ⑧). 테이블 이름 집합만 다시 내보낸다.
import type { DB } from "@tastefit/db";

export type TableName = keyof DB;
export type ProjectRow = DB["projects"];
