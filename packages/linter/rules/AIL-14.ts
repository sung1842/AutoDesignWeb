// AIL-14 브랜드 미반영(04장 4.13.2, C). (a) hero 슬롯에 브랜드명·키워드 0회 = error, (b) 고유 정보 없는 문장 > 60% = warn.
import { finding, isObj, norm, params, sentences } from "../src/lib.js";
import type { Obj, Rule } from "../src/types.js";

const strs = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
/** 브랜드명 + 입력 키워드(keywords·keyPoints·tags) + 고유명사(properNouns·location). */
function terms(brand: Obj | null, minChars: number): { name: string; keys: string[] } {
  if (!brand) return { name: "", keys: [] };
  const name = typeof brand.name === "string" ? norm(brand.name) : "";
  const keys = [
    ...strs(brand.keywords),
    ...strs(brand.keyPoints),
    ...strs(brand.tags),
    ...strs(brand.properNouns),
    ...(typeof brand.location === "string" ? [brand.location] : []),
    ...(isObj(brand.location) && typeof brand.location.area === "string"
      ? [brand.location.area]
      : []),
  ]
    .map(norm)
    .filter((k) => k.length >= minChars && !k.startsWith("["));
  return { name, keys };
}
const PROPER = /\b[A-Z][a-zA-Z]{2,}/;

export const rule: Rule = {
  id: "AIL-14",
  stage: ["C"],
  severity: ["error", "warn"],
  appliesTo: ["M"],
  messageKo: "브랜드 이름이나 입력한 핵심어가 카피에 드러나지 않습니다.",
  fixHint: "히어로에 브랜드명·핵심 키워드를 넣고, 문장마다 숫자·지명 같은 고유 정보를 담으세요.",
  check(ctx) {
    if (!ctx.copy || !ctx.brand) return [];
    const p = params<{ plainRatioMax: number; keyMinChars: number }>("AIL-14");
    const { name, keys } = terms(ctx.brand, p.keyMinChars);
    if (!name && keys.length === 0) return [];
    const has = (t: string): boolean => {
      const s = norm(t);
      return (name !== "" && s.includes(name)) || keys.some((k) => s.includes(k));
    };
    const out = [];
    const hero = ctx.copy.filter((c) => c.role.startsWith("hero."));
    if (hero.length > 0 && !hero.some((c) => has(c.text)))
      out.push(finding("AIL-14", "error", "(a) hero 슬롯에 브랜드명·키워드 0회"));
    const ss = ctx.copy.flatMap((c) => sentences(c.text));
    const plain = ss.filter((s) => !has(s) && !/\d/.test(s) && !PROPER.test(s)).length;
    if (ss.length > 0 && plain / ss.length > p.plainRatioMax)
      out.push(finding("AIL-14", "warn", `(b) 고유 정보 없는 문장 ${plain}/${ss.length}`));
    return out;
  },
};
