// .env.local → .env 순으로 읽어 process env 아래에 깐다(이미 있는 키는 덮지 않는다. 빈 문자열도 "있음").
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function parseDotenv(text: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || !m[1]) continue;
    let v = m[2] ?? "";
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
    o[m[1]] = v;
  }
  return o;
}

/** root의 .env.local·.env를 env에 합친 새 객체를 돌려준다(env 값이 우선). */
export function withDotenv(
  root: string,
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = {};
  for (const f of [".env", ".env.local"]) {
    const p = join(root, f);
    if (existsSync(p)) Object.assign(merged, parseDotenv(readFileSync(p, "utf8")));
  }
  return { ...merged, ...env };
}
