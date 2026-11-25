// 검사용 렌더(ASM-025 ③, ASM-061): 블록 단독 샘플(AC-03-18·46), 타입 단계 프로브(AC-03-45).
// 컴파일러와 같은 compilePageImpl을 쓴다. node 전용(standardTree가 설정 파일을 읽는다).
import { rootCss } from "@tastefit/design-spec/tokens-css";
import {
  DEFAULT_BRAND,
  patternRaw,
  resolveTree,
  standardTree,
  STANDARD_PATTERN,
  templateDeck,
  type Deck,
  type DesignData,
  type Json,
} from "@tastefit/design-spec";
import { copyDeckLimits } from "@tastefit/layout-schema";
import { compilePageImpl, type PTree, type SpecLike } from "./compile.js";
import { STEP_TOKEN } from "./css/text-roles.js";
import { esc } from "./html.js";

/** 덱 객체 필드 → 4.6.2 상한 표 필드 이름. */
const FIELD_KO: Readonly<Record<string, string>> = {
  title: "제목",
  body: "본문",
  quote: "인용",
  name: "항목명",
  desc: "설명",
  value: "값",
  label: "라벨",
  text: "",
};
const FILL = "가나다라마바사 아자차카타파하 ";
/** 상한 길이 한국어 문구(공백 포함 글자 수 = n, 끝 공백 없음). */
export function maxText(n: number): string {
  let s = "";
  while (s.length < n) s += FILL;
  s = s.slice(0, n);
  return s.endsWith(" ") ? `${s.slice(0, -1)}가` : s;
}
/** 4.6.2 상한으로 채운 덱(AC-03-18 "상한 길이 카피"). 상한이 없는 키는 템플릿 그대로. */
export function maxDeck(deck: Deck): Deck {
  const lim = copyDeckLimits();
  const out: Deck = {};
  for (const [k, vals] of Object.entries(deck)) {
    const l = lim[k];
    const mapV = (v: Json): Json => {
      if (typeof v === "string") return typeof l === "number" && l > 0 ? maxText(l) : v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const o: Record<string, Json> = {};
        for (const [f, x] of Object.entries(v)) {
          const fk = FIELD_KO[f];
          const n = typeof l === "number" ? l : l && fk !== undefined ? (l[fk] ?? 0) : 0;
          if (f === "items" && Array.isArray(x)) o[f] = x.map(mapV);
          else if (typeof x === "string" && n > 0) o[f] = maxText(n);
          else o[f] = x;
        }
        return o;
      }
      return v;
    };
    out[k] = vals.map(mapV);
  }
  return out;
}

export interface SampleInput {
  presetId: string;
  block: string;
  variant: string;
  purpose: string;
  copy: "max" | "typical";
}

/** 블록 하나만 그린 페이지(nav·footer 포함). 프리셋 제외 variant면 null. */
export function renderBlockSampleImpl(input: SampleInput, data: DesignData): string | null {
  const preset = data.presets.find((p) => p.id === input.presetId);
  if (!preset) throw new Error(`프리셋 없음 ${input.presetId}`);
  const excluded = (preset as unknown as { excludedVariants?: string[] }).excludedVariants ?? [];
  if (excluded.includes(input.variant)) return null;
  const { spec } = standardTree(preset.typeId, input.purpose, data);
  const base = templateDeck(input.purpose, data.root);
  if ((base["stats.items"] ?? []).length === 0)
    base["stats.items"] = [1, 2, 3, 4].map((k) => ({ value: `${k}0%`, label: `지표 ${k}` }));
  if ((base["work.items"] ?? []).length === 0)
    base["work.items"] = [1, 2, 3, 4, 5, 6].map((k) => ({
      title: `작업 ${k}`,
      caption: `설명 ${k}`,
    }));
  const deck = input.copy === "max" ? maxDeck(base) : base;
  const raw = patternRaw(
    spec,
    STANDARD_PATTERN[input.purpose] ?? "PS-1",
    deck,
    data,
    { [input.block]: input.variant },
    { order: [input.block === "footer" ? "hero" : input.block], lastInverse: false },
  );
  if (input.block === "footer") raw.footer = { variant: input.variant };
  const tree = resolveTree(raw, data, {
    deck,
    brand: DEFAULT_BRAND,
    seed: spec.spec_id,
    navVariant: spec.layout_constraints.allowed_variants.nav?.[0] ?? "nav.split",
    mediaMode: String(spec.l2["media.mode"]),
  });
  return compilePageImpl(
    spec as unknown as SpecLike,
    tree as unknown as PTree,
    data as unknown as Parameters<typeof compilePageImpl>[2],
  ).html;
}

/** 타입 단계 9종 프로브(AC-03-45 ①): [data-step-probe=<단계>]의 computed font-size = expectedSize. */
export function renderStepProbeImpl(spec: SpecLike): string {
  const css =
    rootCss(spec.tokens, "probe") +
    Object.entries(STEP_TOKEN)
      .map(([step, k]) => `[data-step-probe="${step}"] { font-size: var(--tf-type-${k}); }`)
      .join("\n");
  const body = Object.keys(STEP_TOKEN)
    .map((step) => `<p data-step-probe="${esc(step)}">가</p>`)
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}
