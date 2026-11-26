// 04장 4.6.4 금지 문구 사전 매칭(AC-04-12, ASM-077 ⑤). 사전 = data/linter/cliche_{ko,en}.json(B14).
import { readFileSync } from "node:fs";
import { norm, repoFile } from "./lib.js";
import type { Severity } from "./types.js";

interface Item {
  id: string;
  text: string;
  pattern: string;
  flags: string;
}
export interface ClicheHit {
  id: string;
  text: string;
  match: string;
  severity: Severity;
  lang: "ko" | "en";
}
let DICT: { lang: "ko" | "en"; item: Item; re: RegExp }[] | null = null;
function dict(): { lang: "ko" | "en"; item: Item; re: RegExp }[] {
  if (DICT) return DICT;
  DICT = (["ko", "en"] as const).flatMap((lang) =>
    (
      JSON.parse(readFileSync(repoFile(`data/linter/cliche_${lang}.json`), "utf8")) as {
        items: Item[];
      }
    ).items.map((item) => ({
      lang,
      item,
      re: new RegExp(item.pattern, item.flags.includes("i") ? "iu" : "u"),
    })),
  );
  return DICT;
}

/**
 * 문장에서 사전 항목을 찾는다. 기본은 LLM 생성 슬롯(error).
 * 사용자 원문 슬롯(slot=user)에서 사용자가 직접 쓴 표현(userText 안에 같은 문자열)은 warn으로 낮춘다.
 */
export function matchCliche(
  text: string,
  opts: { slot?: "llm" | "user"; userText?: string } = {},
): ClicheHit[] {
  const t = norm(text);
  const user = opts.userText ? norm(opts.userText).toLowerCase() : "";
  const out: ClicheHit[] = [];
  for (const { lang, item, re } of dict()) {
    const m = re.exec(t);
    if (!m) continue;
    const userOwn = opts.slot === "user" && user.includes(m[0].toLowerCase());
    out.push({
      id: item.id,
      text: item.text,
      match: m[0],
      severity: userOwn ? "warn" : "error",
      lang,
    });
  }
  return out;
}
