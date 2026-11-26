// AIL-18 기본 아이콘 무조정(04장 4.13.2, T·D). 세트 ∉ 허용 ∨ Lucide 기본(stroke 2·24px) = error, 섹션당 아이콘 > 4 = warn.
import { finding, l2Of, listItems, params, sections, variantMeta } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface P {
  allowedSets: string[];
  lucideStroke: number;
  lucideSize: number;
  perSectionMax: number;
}
export const rule: Rule = {
  id: "AIL-18",
  stage: ["T", "D"],
  severity: ["error", "warn"],
  appliesTo: ["M", "U"],
  messageKo: "기본 아이콘 세트를 손대지 않고 그대로 썼거나 아이콘이 너무 많습니다.",
  fixHint: "Phosphor·Tabler·Iconoir 중 프리셋 세트를 쓰고, 섹션당 아이콘은 4개 이하로 줄이세요.",
  check(ctx) {
    const p = params<P>("AIL-18");
    const out: LintFinding[] = [];
    if (ctx.tree) {
      const set = l2Of(ctx.spec, "icon.set");
      if (set !== undefined && set !== "none" && !p.allowedSets.includes(set))
        out.push(finding("AIL-18", "error", `icon.set ${set} 허용 밖`));
      for (const s of sections(ctx.tree)) {
        const n = variantMeta(s.variant)?.icon_grid ? listItems(s).length : 0;
        if (n > p.perSectionMax) out.push(finding("AIL-18", "warn", `${s.id} 아이콘 ${n}개`));
      }
    }
    if (ctx.snapshot) {
      const icons = ctx.snapshot.elements.filter((e) => e.icon);
      const bad = icons.filter((e) => {
        const ic = e.icon;
        if (!ic) return false;
        if (ic.set !== null && !p.allowedSets.includes(ic.set)) return true;
        return ic.stroke === p.lucideStroke && Math.round(ic.size) === p.lucideSize;
      });
      if (bad.length > 0)
        out.push(finding("AIL-18", "error", `기본 아이콘 ${bad.length}개(${bad[0]?.icon?.set ?? "stroke 2·24px"})`));
      const per = new Map<number, number>();
      for (const e of icons) per.set(e.section, (per.get(e.section) ?? 0) + 1);
      for (const [sec, n] of per)
        if (n > p.perSectionMax) out.push(finding("AIL-18", "warn", `섹션 ${sec} 아이콘 ${n}개`));
    }
    return out;
  },
};
