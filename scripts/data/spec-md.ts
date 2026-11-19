// FINAL 장 마크다운에서 표·목록을 읽는다(seed:temp가 "다른 장에 정의된 값을 그대로 JSON화"할 때 쓴다, 09장 9.2.4).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SPEC_DIR = "docs/spec/FINAL";

export function chapter(root: string, file: string): string {
  return readFileSync(join(root, SPEC_DIR, file), "utf8");
}

/** `heading`(예: "### 2.11.1")으로 시작하는 절 본문(같은 수준 이상의 다음 제목 전까지). */
export function section(md: string, heading: string): string {
  const start = md.indexOf(`${heading} `);
  if (start < 0) throw new Error(`절 없음: ${heading}`);
  const level = /^#+/.exec(heading)?.[0].length ?? 3;
  const rest = md.slice(start + heading.length);
  const re = new RegExp(`\\n#{1,${level}} `);
  const m = re.exec(rest);
  return md.slice(start, start + heading.length + (m ? m.index : rest.length));
}

/** 절 안의 첫 표를 행 배열(셀 trim, 머리·구분 행 제외)로. */
export function table(sec: string): string[][] {
  const lines = sec.split("\n");
  const first = lines.findIndex((l) => l.startsWith("|"));
  const rows: string[] = [];
  for (let i = first; i >= 0 && i < lines.length && (lines[i] ?? "").startsWith("|"); i++)
    rows.push(lines[i] ?? "");
  return rows.slice(2).map((l) =>
    l
      .slice(1, l.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => c.trim()),
  );
}

export const unquote = (s: string): string => s.replace(/^`|`$/g, "");
