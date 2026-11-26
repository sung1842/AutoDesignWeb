// 묶음별 키 스키마(09장 9.2.3). 여기 없는 필드는 정의 장 스키마를 따르므로 looseObject로 허용한다.
// 수량·교차 참조는 data:validate(scripts/data)가 검사한다.
import { z } from "zod";

export const AXIS_IDS = ["A1", "A2", "A3", "A4", "A5"] as const;
/** R-01 JSON 키(A1~A5 순서). */
export const AXIS_KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
export type AxisId = (typeof AXIS_IDS)[number];
export type AxisKey = (typeof AXIS_KEYS)[number];
export const PURPOSE_IDS = ["saas", "portfolio", "local_business"] as const;
export const TEMPLATE_IDS = ["tpl-hero", "tpl-grid", "tpl-text"] as const;

const unit = z.number().min(0).max(1);
export const l1Tuple = z.tuple([unit, unit, unit, unit, unit]);
export const l1Object = z.strictObject({
  expression: unit,
  temperature: unit,
  shape: unit,
  density: unit,
  depth: unit,
});
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

// B1
export const axis = z.looseObject({
  id: z.enum(AXIS_IDS),
  key: z.enum(AXIS_KEYS),
  nameKo: z.string().min(1),
  lowLabelKo: z.string().min(1),
  highLabelKo: z.string().min(1),
});

// B2 (id·앵커 형식은 02장 2.11.1)
export const typeDef = z.looseObject({
  id: z.string().regex(/^T[1-8]$/),
  slug: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  nameKo: z
    .string()
    .min(1)
    .max(14)
    .refine((s) => !/mbti/i.test(s), "성격검사 상표 표기 금지(D-01)"),
  summaryKo: z.string().min(1).max(60),
  // 02장 2.11.2 고정 문안(154~190자)이 표기 범위 200~400자보다 짧다. 문안이 단일 원천(R-04)이라 하한은 두지 않는다(ASM-010).
  descriptionKo: z.string().min(1).max(400),
  strengthsKo: z.array(z.string().min(1).max(30)).length(3),
  centroid: l1Tuple,
  anchorPresetId: z.string().regex(/^PS-T[1-8]$/),
});

// B3
export const preset = z.looseObject({
  id: z.string().min(1),
  typeId: z.string().regex(/^T[1-8]$/),
  l1: l1Tuple,
  l2: z.record(z.string(), z.string()),
  tokens: z.unknown(),
  allowed: z.record(z.string(), z.array(z.string())),
  signatureIds: z.array(z.string()),
  theme: z.enum(["light", "dark"]),
});

// B4
export const purpose = z.looseObject({
  id: z.enum(PURPOSE_IDS),
  nameKo: z.string().min(1),
  requiredSections: z.array(z.string()).min(1),
  optionalSections: z.array(z.string()),
  axisClip: z.record(z.enum(AXIS_IDS), z.tuple([unit, unit])),
  imageTags: z.array(z.string()).min(1),
});

// B5: 03장 3.3.2 매핑표. 항목 = L2 파라미터 1개.
export const mappingRow = z.looseObject({ id: z.string().min(1) });

// B6
export const fontEntry = z.looseObject({
  id: z.string().min(1),
  family: z.string().min(1),
  script: z.enum(["hangul", "latin"]),
  classification: z.string().min(1),
  license: z.enum(["OFL-1.1", "Apache-2.0", "MIT"]),
  licenseUrl: z.string().url(),
  sourceUrl: z.string().url(),
  files: z.array(
    z.strictObject({
      weight: z.number().int().min(100).max(900),
      style: z.enum(["normal", "italic"]),
      path: z.string().min(1),
      sha256,
      subset: z.enum(["full", "ks-x-1001", "latin"]),
    }),
  ),
  reservedFontName: z.boolean(),
});

// B7
export const fontPairing = z.looseObject({
  id: z.string().min(1),
  headingFontId: z.string().min(1),
  bodyFontId: z.string().min(1),
  labelFontId: z.string().min(1).optional(),
  tags: z.array(z.string()),
});

// B8
export const imageEntry = z.looseObject({
  id: z.string().min(1),
  path: z.string().min(1),
  sha256,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tags: z.array(z.string()).min(1),
  focalPoint: z.tuple([unit, unit]),
  dominantColor: hex,
  source: z.enum(["unsplash", "cc0", "own", "placeholder"]),
  sourceUrl: z.string().url().optional(),
  author: z.string().optional(),
  license: z.string().min(1),
  licenseUrl: z.string().url().optional(),
  hasRecognizableFace: z.literal(false),
  hasLogoOrTrademark: z.literal(false),
});

// B9: 봉투 items는 1개(SurveyTemplates).
export const surveyTemplates = z.looseObject({
  demoBrand: z.looseObject({
    name: z.string().min(1),
    tagline: z.string().min(1),
    copy: z.record(z.string(), z.string()),
  }),
  templates: z
    .array(
      z.looseObject({
        id: z.enum(TEMPLATE_IDS),
        page: z.unknown(),
        imageIds: z.array(z.string()),
      }),
    )
    .length(3),
});

// B10 (카드 ID 형식 02장 2.4.2)
export const cardSpec = z.looseObject({
  id: z.string().regex(/^C-SV\d{2}-(hero|grid|text)$/),
  presetId: z.string().min(1),
  templateId: z.enum(TEMPLATE_IDS),
  l2Overrides: z.record(z.string(), z.string()),
  altKo: z.string().min(5).max(160),
});

// B11
export const abPairSpec = z.looseObject({
  id: z.string().min(1),
  axis: z.enum(AXIS_IDS),
  basePresetId: z.string().min(1),
  levelA: unit,
  levelB: unit,
  templateId: z.enum(TEMPLATE_IDS),
});

// B12
export const approval = z.looseObject({
  assetId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().optional(),
  reviewedAt: z.string().min(1),
});

// B13
export const referenceSeed = z.looseObject({
  id: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  titleKo: z.string().min(1).max(40),
  l1: l1Tuple,
  tier: z.enum(["T1", "T2", "T3"]),
  styleTags: z.array(z.string()),
  robotsCheckedAt: z.string().min(1),
  termsCheckedAt: z.string().min(1),
  optOut: z.literal(false),
});

// B14: 금지 표현 1건.
export const clicheEntry = z.looseObject({ id: z.string().min(1), text: z.string().min(1) });

// B15 (파일 1개 = 예시 1건, 봉투 없음)
export const linterExample = z.looseObject({
  ruleId: z.string().min(1),
  expect: z.enum(["violation", "clean"]),
  page: z.unknown(),
  tokens: z.unknown(),
});

// B16 (07장 7.2.2, 파일 1개 = 케이스 1건, 봉투 없음)
export const goldenCase = z.looseObject({
  id: z.string().regex(/^GS-\d{2}$/),
  provenance: z.enum(["human", "temp"]),
  kind: z.enum(["core", "edge"]),
  purpose: z.enum(PURPOSE_IDS),
  persona: z.looseObject({
    thetaStar: l1Object,
    simulator: z.looseObject({ beta: z.number(), policy: z.string(), seed: z.number().int() }),
  }),
  answers: z.array(z.unknown()).nullable(),
  brand: z.record(z.string(), z.unknown()),
  expected: z.looseObject({
    typeId: z.string().regex(/^T[1-8]$/),
    anchorPresetId: z.string().regex(/^PS-T[1-8]$/),
    muRef: l1Object.nullable(),
    flags: z.array(z.string()),
    brandNameIn: z.array(z.string()),
    mustNotLint: z.array(z.string()),
    fallbackAllowed: z.boolean(),
  }),
});

// B18 (05장 5.8.2, 파일 = 본문, 봉투 없음)
export const normalizer = z.looseObject({
  version: z.string().regex(/^\d{4}-S[0-4]$/),
  provenance: z.enum(["human", "temp"]),
  extractor_version: z.string().min(1),
  features: z.record(z.string(), z.unknown()),
  mapping: z.record(z.enum(AXIS_KEYS), z.unknown()),
  reliable: z.record(z.enum(AXIS_KEYS), z.boolean()),
  inter_rater: z.enum(["verified", "unverified"]),
});

/** B20~B25 등 키 표가 정의 장에 있는 묶음: id 있는 항목. */
export const keyedItem = z.looseObject({ id: z.string().min(1) });

/** 05장 5.3 candidates.csv 열(LG-01-2). observations/*.csv도 같은 열. */
export const CANDIDATE_CSV_COLUMNS = [
  "url",
  "tier",
  "source_id",
  "use",
  "lang_guess",
  "era_guess",
  "redesigned_at",
  "maker",
  "found_at",
  "note",
] as const;
