// 06장 6.10.4 feature_flags: 행이 있으면 그 값, 없으면 환경 변수, 그것도 없으면 기본값(ASM-110 ②).
import { q, type Tx } from "./port.js";

export async function flagValue(tx: Tx, key: string, dflt: unknown): Promise<unknown> {
  const r = await q(tx, "select value from feature_flags where key = $1", [key]);
  if (r.rows[0]) return r.rows[0].value;
  const env = process.env[key];
  if (env === undefined || env === "") return dflt;
  if (env === "true" || env === "false") return env === "true";
  const n = Number(env);
  return Number.isNaN(n) ? env : n;
}
