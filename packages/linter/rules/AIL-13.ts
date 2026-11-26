// AIL-13 일반론 카피(04장 4.13.2, C): 금지 사전(4.6.4) 매칭. LLM 슬롯 = error, 사용자 원문 슬롯의 사용자 표현 = warn(4.6.4).
import { matchCliche } from "../src/cliche.js";
import { finding } from "../src/lib.js";
import type { Rule } from "../src/types.js";

export const rule: Rule = {
  id: "AIL-13",
  stage: ["C"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "어디에나 붙는 일반론 문구(금지 사전)가 들어 있습니다.",
  fixHint: "지역·제품·숫자처럼 이 브랜드만의 구체적인 사실로 바꾸세요.",
  check(ctx) {
    const userText = (ctx.copy ?? [])
      .filter((c) => c.source === "user")
      .map((c) => c.text)
      .join(" ");
    return (ctx.copy ?? []).flatMap((c) =>
      matchCliche(c.text, { slot: c.source ?? "llm", userText }).map((h) =>
        finding("AIL-13", h.severity, `${c.role}: 금지 문구 "${h.match}"(${h.id})`),
      ),
    );
  },
};
