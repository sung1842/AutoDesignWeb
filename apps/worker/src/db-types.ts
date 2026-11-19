// db:types 산출을 worker에서 쓰는 지점(09장 9.4.3 ⑧).
import type { DB } from "@tastefit/db";

export type TableName = keyof DB;
export type GenerationJobRow = DB["generation_jobs"];
