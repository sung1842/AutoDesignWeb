// 02장 2.4.3·2.4.5 설문 자극물 페이지(카드·A/B 이미지) = 프리셋 + L2 덮어쓰기 명세 + 템플릿 고정 트리(ASM-092).
// 템플릿 구성은 data/survey/templates.json(B9)이 원천이고, 슬롯은 03장 blocks.json 정의에 맞춰 옮긴다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignData } from "./data.js";
import { standardTree } from "./stubs.js";
import type { DesignSpec } from "./types.js";

type Obj = Record<string, unknown>;
interface TemplateSection {
  id: string;
  block: string;
  variant: string;
  slots: Record<string, unknown>;
}
interface Template {
  id: string;
  page: { viewport: [number, number]; sections: TemplateSection[] };
  imageIds: string[];
}
interface SurveyTemplates {
  demoBrand: { name: string; copy: Record<string, string> };
  templates: Template[];
}
let CACHE: { root: string; t: SurveyTemplates } | null = null;
function templates(root: string): SurveyTemplates {
  if (CACHE?.root === root) return CACHE.t;
  const items = (
    JSON.parse(readFileSync(join(root, "data/survey/templates.json"), "utf8")) as {
      items: SurveyTemplates[];
    }
  ).items;
  const t = items[0];
  if (!t) throw new Error("templates.json 비어 있음");
  CACHE = { root, t };
  return t;
}

/** 고정 문구(덱이 아님): deck_ref는 설문 템플릿 표지로 둔다. */
const REF = "deck:survey.fixed#0";
const text = (t: string): Obj => ({ copy: { text: t, placeholder: false, deck_ref: REF } });
const item = (t: string, sub?: string): Obj => ({
  copy: { text: t, ...(sub ? { sub } : {}), placeholder: false, deck_ref: REF },
});
const split = (s: string): string[] => s.split(/\s*\/\s*/).filter(Boolean);

export interface SurveyPlan {
  presetId: string;
  templateId: string;
  l2Overrides?: Record<string, string>;
}

/** 설문 자극물 1장의 명세·트리. 명세 = 프리셋 기본 L2 + 덮어쓰기(standardTree l2 경로, 토큰 재생성). */
export function surveyPage(
  plan: SurveyPlan,
  data: DesignData,
): { spec: DesignSpec; tree: Obj; viewport: [number, number] } {
  const preset = data.presets.find((p) => p.id === plan.presetId);
  if (!preset) throw new Error(`프리셋 없음 ${plan.presetId}`);
  const st = templates(data.root);
  const tpl = st.templates.find((t) => t.id === plan.templateId);
  if (!tpl) throw new Error(`템플릿 없음 ${plan.templateId}`);
  const { spec } = standardTree(preset.typeId, "portfolio", data, {
    l2: { ...preset.l2, ...(plan.l2Overrides ?? {}) } as never,
  });
  const c = st.demoBrand.copy;
  const img = (i: number): Obj => {
    const id = tpl.imageIds[i] ?? tpl.imageIds[0] ?? "";
    const m = data.images.find((x) => x.id === id);
    const tag =
      m?.tags.find((t) => !t.startsWith("tone.") && !t.startsWith("orient.")) ??
      "common.texture-paper";
    return {
      image: {
        tag,
        ratio: m && m.height > m.width ? "4:5" : "3:2",
        asset_id: id,
        alt: m?.altKo ?? "",
        focal: m?.focalPoint ?? [0.5, 0.5],
      },
    };
  };
  const sections: Obj[] = [];
  let nav: Obj | null = null;
  for (const s of tpl.page.sections) {
    const variant = `${s.block}.${s.variant}`;
    const base = { id: s.id, block: s.block, variant, bg: "bg", pad: 0 };
    if (s.block === "nav") {
      nav = {
        variant,
        items: split(c[String(s.slots.links)] ?? "").map((label, i) => ({
          label,
          target: `#${tpl.page.sections[i + 1]?.id ?? "s1"}`,
        })),
      };
      continue;
    }
    const slots: Obj = {};
    if (s.block === "hero") {
      slots.headline = text(c["hero.headline"] ?? "");
      slots.sub = text(c["hero.sub"] ?? "");
      slots.primaryCta = { link: { label: text(c["hero.primaryCta"] ?? "").copy, target: "#s3" } };
      slots.secondaryCta = {
        link: { label: text(c["hero.secondaryCta"] ?? "").copy, target: "#s3" },
      };
      slots.media = img(0);
    } else if (s.block === "value") {
      slots.items = {
        list: (s.slots.items as string[]).map((k) => {
          const [t, b] = split(c[k] ?? "");
          return item(t ?? "", b);
        }),
      };
    } else if (s.block === "gallery") {
      const [from = "기본 01"] = split(c["grid.item"] ?? "").map((x) => x.split("~")[0] ?? x);
      const prefix = from.replace(/\d+$/, "");
      slots.media = img(0);
      slots.captions = {
        list: Array.from({ length: 6 }, (_, i) =>
          item(`${prefix}${String(i + 1).padStart(2, "0")}`, c["grid.itemSub"]),
        ),
      };
    } else if (s.block === "cta") {
      slots.headline = text(c["grid.desc"] ?? c["grid.title"] ?? "");
      slots.primaryCta = { link: { label: text(c["grid.cta"] ?? "").copy, target: "#s1" } };
    } else if (s.block === "proof") {
      slots.items = { list: [item(c["text.quote"] ?? "", c["text.signature"])] };
    } else if (s.block === "story") {
      slots.body = text(c["text.body"] ?? "");
      slots.media = img(0);
    } else if (s.block === "stats") {
      const vals = split(c["text.stats"] ?? "");
      const labels = split(c["text.statLabels"] ?? "");
      slots.items = { list: vals.map((v, i) => item(v, labels[i])) };
    }
    sections.push({ ...base, slots });
  }
  const tree: Obj = {
    schemaVersion: "1",
    spec_id: (spec as unknown as { spec_id: string }).spec_id,
    // 설문 페이지는 패턴 카탈로그 밖 고정 구성이다. 스키마 enum을 지키려 용도 중립 PP-1로 표시한다
    pattern_id: "PP-1",
    nav: nav ?? { variant: "nav.minimal", items: [] },
    sections,
    footer: {
      variant: "footer.minimal",
      slots: {
        wordmark: text(st.demoBrand.name),
        businessInfo: {
          copy: {
            text: `상호 ${st.demoBrand.name} · 사업자등록번호 000-00-00000 · 서울시 ○○구 ○○로 00`,
            placeholder: true,
            deck_ref: "deck:contact.biz#0",
          },
        },
      },
    },
  };
  return { spec, tree, viewport: tpl.page.viewport };
}
