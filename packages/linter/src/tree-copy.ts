// 확정 트리(PageSchema) → 린터 카피 목록(단계 C 입력, ASM-085 ②). worker 평가·copyRules가 함께 쓴다.
import type { CopyItem } from "./types.js";

type Obj = { [k: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

/** 확정 트리의 텍스트 → 린터 카피(role = 블록.슬롯, 목록 항목은 .item). */
export function copyOfTree(tree: unknown): CopyItem[] {
  const out: CopyItem[] = [];
  const text = (v: unknown): string | null => {
    if (!isObj(v)) return null;
    if (isObj(v.copy) && typeof v.copy.text === "string") return v.copy.text;
    if (isObj(v.link)) return text(v.link.label);
    if (isObj(v.label) && typeof v.label.text === "string") return v.label.text;
    if (typeof v.text === "string") return v.text;
    return null;
  };
  const visit = (block: string, slots: unknown): void => {
    if (!isObj(slots)) return;
    for (const [k, v] of Object.entries(slots)) {
      const role = `${block}.${k}`.toLowerCase();
      const t = text(v);
      if (t !== null)
        out.push({
          role: /cta|link|button/.test(role) && isObj(v) && isObj(v.link) ? "button" : role,
          text: t,
        });
      if (isObj(v) && Array.isArray(v.list))
        for (const it of v.list) {
          const s = text(it);
          if (s !== null) out.push({ role: `${role}.item`, text: s });
          // 목록 항목 보조 문구(본문·이름 등, copy.sub)
          if (isObj(it) && isObj(it.copy) && typeof it.copy.sub === "string")
            out.push({ role: `${role}.item.sub`, text: it.copy.sub });
        }
    }
  };
  if (!isObj(tree)) return out;
  if (isObj(tree.nav)) {
    visit("nav", tree.nav.slots);
    if (Array.isArray(tree.nav.items))
      for (const it of tree.nav.items)
        if (isObj(it) && typeof it.label === "string")
          out.push({ role: "nav.item", text: it.label });
  }
  for (const s of Array.isArray(tree.sections) ? tree.sections : [])
    if (isObj(s)) visit(String(s.block ?? ""), s.slots);
  if (isObj(tree.footer)) visit("footer", tree.footer.slots);
  return out;
}
