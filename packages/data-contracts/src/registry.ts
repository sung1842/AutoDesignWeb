// 묶음 레지스트리: 09장 9.2.2 B1~B25 + 03장 3.0의 나머지 산출 파일. data:validate·seed:temp가 이 표만 본다.
import type { z } from "zod";
import * as S from "./bundles.js";

/**
 * 배치 형식.
 * - envelope: JSON 파일 1개 = 봉투
 * - envelopeDir: 디렉터리의 *.json 각각 = 봉투(항목 1개, 파일 이름 = id)
 * - itemDir: 디렉터리(하위 포함)의 *.json 각각 = 봉투 없는 항목 1개(provenance 필드 보유 가능)
 * - text·yaml: 텍스트 파일(형식 검사는 data:validate의 규칙)
 */
export type Layout = "envelope" | "envelopeDir" | "itemDir" | "text" | "yaml";

export interface BundleDef {
  id: string; // "B3" 또는 "C03-blocks"
  name: string; // 봉투 bundle 값
  paths: string[]; // 저장소 루트 기준
  layout: Layout;
  item?: z.ZodType;
  /** 0개 허용(B19). */
  optional?: boolean;
  /** temp id에 tmp_ 접두사가 필요한 묶음(id 형식을 다른 장이 정하지 않음, ASM-008). */
  freeIds?: boolean;
}

export const BUNDLES: BundleDef[] = [
  {
    id: "B1",
    name: "axes",
    paths: ["data/taxonomy/axes.json"],
    layout: "envelope",
    item: S.axis,
  },
  {
    id: "B2",
    name: "types",
    paths: ["data/taxonomy/types.json"],
    layout: "envelope",
    item: S.typeDef,
  },
  {
    id: "B3",
    name: "presets",
    paths: ["data/taxonomy/presets"],
    layout: "envelopeDir",
    item: S.preset,
  },
  {
    id: "B4",
    name: "purposes",
    paths: ["data/taxonomy/purposes.json"],
    layout: "envelope",
    item: S.purpose,
  },
  {
    id: "B5",
    name: "mapping",
    paths: ["data/taxonomy/mapping.json"],
    layout: "envelope",
    item: S.mappingRow,
  },
  {
    id: "B6",
    name: "fonts",
    paths: ["data/fonts/registry.json"],
    layout: "envelope",
    item: S.fontEntry,
    freeIds: true,
  },
  {
    id: "B7",
    name: "pairings",
    paths: ["data/fonts/pairings.json"],
    layout: "envelope",
    item: S.fontPairing,
    freeIds: true,
  },
  {
    id: "B8",
    name: "images",
    paths: ["data/images/manifest.json"],
    layout: "envelope",
    item: S.imageEntry,
    freeIds: true,
  },
  {
    id: "B9",
    name: "survey-templates",
    paths: ["data/survey/templates.json"],
    layout: "envelope",
    item: S.surveyTemplates,
  },
  {
    id: "B10",
    name: "card-plan",
    paths: ["data/survey/card_plan.json"],
    layout: "envelope",
    item: S.cardSpec,
  },
  {
    id: "B11",
    name: "ab-plan",
    paths: ["data/survey/ab_plan.json"],
    layout: "envelope",
    item: S.abPairSpec,
  },
  {
    id: "B12",
    name: "approvals",
    paths: ["data/survey/approvals.json"],
    layout: "envelope",
    item: S.approval,
  },
  {
    id: "B13",
    name: "references",
    paths: ["data/references/seed.json"],
    layout: "envelope",
    item: S.referenceSeed,
    freeIds: true,
  },
  {
    id: "B14",
    name: "cliche",
    paths: ["data/linter/cliche_ko.json", "data/linter/cliche_en.json"],
    layout: "envelope",
    item: S.clicheEntry,
  },
  {
    id: "B15",
    name: "linter-examples",
    paths: ["data/linter/examples"],
    layout: "itemDir",
    item: S.linterExample,
  },
  {
    id: "B16",
    name: "golden",
    paths: ["data/golden"],
    layout: "itemDir",
    item: S.goldenCase,
  },
  {
    id: "B17",
    name: "legal",
    paths: ["legal/terms.md", "legal/privacy.md", "legal/sources.md"],
    layout: "text",
  },
  {
    id: "B18",
    name: "normalizers",
    paths: ["data/normalizers"],
    layout: "itemDir",
    item: S.normalizer,
  },
  {
    id: "B19",
    name: "fewshot",
    paths: ["data/fewshot"],
    layout: "itemDir",
    optional: true,
  },
  {
    id: "B20",
    name: "copy-templates",
    paths: ["config/copy_templates.json", "config/axis_hints.json"],
    layout: "envelope",
    item: S.keyedItem,
  },
  {
    id: "B21",
    name: "high-risk-brands",
    paths: ["config/high_risk_brands.json"],
    layout: "envelope",
    item: S.keyedItem,
  },
  {
    id: "B22",
    name: "prohibited-categories",
    paths: ["config/prohibited_categories.json"],
    layout: "envelope",
    item: S.keyedItem,
  },
  {
    id: "B23",
    name: "processors",
    paths: ["legal/processors.yaml", "legal/data-flows.yaml"],
    layout: "yaml",
  },
  {
    id: "B24",
    name: "image-tag-keywords",
    paths: ["config/image_tag_keywords.json"],
    layout: "envelope",
    item: S.keyedItem,
  },
  {
    id: "B25",
    name: "text-roles",
    paths: ["data/taxonomy/text-roles.json"],
    layout: "envelope",
    item: S.keyedItem,
  },
  // 03장 3.0의 나머지 산출 파일(AC-03-01 14종 중 B 묶음이 아닌 것)
  ...(
    [
      ["taxonomy", "data/taxonomy/taxonomy.json"],
      ["palettes", "data/taxonomy/palettes.json"],
      ["blocks", "data/taxonomy/blocks.json"],
      ["components", "data/taxonomy/components.json"],
      ["signatures", "data/taxonomy/signatures.json"],
      ["harmony", "data/taxonomy/harmony.json"],
      ["token-schema", "data/tokens/schema.json"],
      ["icons", "data/icons/map.json"],
    ] as const
  ).map(([name, path]): BundleDef => ({
    id: `C03-${name}`,
    name,
    paths: [path],
    layout: "envelope",
    item: S.keyedItem,
  })),
];

export const bundleById = (id: string): BundleDef | undefined => BUNDLES.find((b) => b.id === id);
