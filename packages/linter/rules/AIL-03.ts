// AIL-03 기본 서체(04장 4.13.2). S = 토큰 서체, D = computed font-family(mono·아이콘 제외).
import { readFileSync } from "node:fs";
import { finding, params, repoFile } from "../src/lib.js";
import { staticLintImpl } from "../src/stage-s.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  singleFamilyBanned: string[];
  headingFirstBanned: string[];
}
let REG: Map<string, { family: string; mono: boolean }> | null = null;
function registry(): Map<string, { family: string; mono: boolean }> {
  if (!REG) {
    const items = (
      JSON.parse(readFileSync(repoFile("data/fonts/registry.json"), "utf8")) as {
        items: { subsetFamily: string; family: string; classification: string }[];
      }
    ).items;
    REG = new Map(
      items.map((f) => [
        f.subsetFamily.toLowerCase(),
        { family: f.family, mono: f.classification === "mono" },
      ]),
    );
  }
  return REG;
}
const MONO_GENERIC = /^(monospace|ui-monospace)$/i;
const ICON_FONT = /icon|material symbols|font awesome/i;
/** font-family 첫 항목 → 실제 패밀리(레지스트리 subsetFamily 매핑). mono·아이콘이면 null. */
function familyOf(ff: string): string | null {
  const first = (ff.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!first || MONO_GENERIC.test(first) || ICON_FONT.test(first)) return null;
  const r = registry().get(first.toLowerCase());
  if (r) return r.mono ? null : r.family;
  return first;
}
const eq = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export const rule: Rule = {
  id: "AIL-03",
  stage: ["S", "D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "기본 서체만 쓰면 개성 없는 AI 페이지처럼 보입니다.",
  fixHint: "헤드라인에 성격 있는 서체(명조·디스플레이)를 쓰고 본문과 짝을 맞추세요.",
  check(ctx) {
    const out: LintFinding[] = [];
    if (ctx.spec && ctx.stages.has("S"))
      out.push(...staticLintImpl(ctx.spec).filter((f) => f.rule === "AIL-03"));
    if (!ctx.snapshot) return out;
    const p = params<P>("AIL-03");
    const texty = ctx.snapshot.elements.filter((e) => e.text.length > 0);
    const used = new Set<string>();
    for (const e of texty) {
      const f = familyOf(e.fontFamily);
      if (f) used.add(f);
    }
    const one = used.size === 1 ? ([...used][0] ?? "") : null;
    if (one !== null && p.singleFamilyBanned.some((b) => eq(b, one)))
      out.push(finding("AIL-03", "error", `사용 서체 1종: ${one}`));
    else
      for (const e of texty.filter((x) => x.heading)) {
        const f = familyOf(e.fontFamily);
        if (f && p.headingFirstBanned.some((b) => eq(b, f))) {
          out.push(finding("AIL-03", "error", `헤딩 기본 서체: ${f}`));
          break;
        }
      }
    return out;
  },
};
