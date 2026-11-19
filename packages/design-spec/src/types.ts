// design-spec 공개 타입(04장 4.2.1, ASM-023·024). 스키마 원본은 @tastefit/data-contracts의 DesignSpecSchema.
import type { L2 } from "@tastefit/taxonomy";

export type AxisKey = "expression" | "temperature" | "shape" | "density" | "depth";
export type Vec5 = Record<AxisKey, number>;
export type Variant = "v_true" | "v_fit" | "v_bal";
export type Purpose = "saas" | "local_business" | "portfolio";

export interface TasteResult {
  mu: Vec5;
  sigma: Vec5;
  kappa: number;
  insensitive_axes: AxisKey[];
  type_id: string;
  anchor_override_type_id?: string;
}

export interface MovedAxis {
  axis: AxisKey;
  from: number;
  to: number;
  reason: "type" | "purpose" | "distance";
}

export interface CalibrationTrace {
  mu: Vec5;
  sigma: Vec5;
  kappa: number;
  insensitive_axes: AxisKey[];
  anchor: Vec5;
  type_range: { lo: Vec5; hi: Vec5 };
  g: Vec5;
  v1: Vec5;
  alpha: number;
  v2: Vec5;
  distance_enforced: boolean;
  moved_axes: MovedAxis[];
}

export interface DesignSpec {
  spec_version: "1";
  spec_id: string;
  variant: Variant;
  taxonomy_version: string;
  preset_version: string;
  normalizer_version: string;
  type_id: string;
  diagnosed_type_id: string;
  purpose: Purpose;
  theme: "light" | "dark";
  target_vector: Vec5;
  calibration_trace: CalibrationTrace;
  l2: L2;
  tokens: Record<string, unknown>;
  layout_constraints: {
    section_count: { min: number; max: number };
    required_blocks: string[];
    optional_blocks: string[];
    forbidden_blocks: string[];
    allowed_variants: Record<string, string[]>;
    hero_variants: string[];
    pattern_slots: [string, string];
    rhythm: Record<string, unknown>;
    image_tags_allowed: string[];
  };
  copy: {
    tone_id: string;
    ending: "hamnida" | "haeyo" | "plain";
    headline_option_preference: string[];
    exclaim_max_per_page: 0 | 1;
  };
  signature: { id: string; intensity: 1 | 2; apply_to: string[] };
  decor: { effects: string[]; max: 1 | 2 };
  forbidden: { lint_rules_strict: string[]; conflict_ids: string[] };
  brand_color: null | {
    hex_in: string;
    hue_locked: number;
    role: "primary" | "accent";
    adjusted_hex: string;
    delta_e_ok: number;
  };
  brand_color_notice: null | "adjusted" | "demoted_to_accent" | "used_as_tint" | "ignored";
}

/** 03장 3.2.4 요구 조건·충돌 열(ASM-023 ①). */
export interface SigCtx {
  theme: "light" | "dark";
  shapeBorder: string;
  gridMode: string;
  motionLevel: string;
  depthStyle: string;
  mediaTreatment: string;
  chroma: "muted" | "moderate" | "vivid";
  sectionCount: number;
  hasNumberSlot: boolean;
  hasImageSlot: boolean;
  pairingHasMono: boolean;
  displayPx: number;
}

export interface DerivedTokens {
  tokenSet: Record<string, unknown>;
  accentTextSafe: boolean;
  inverseButtonMode: "primary" | "invert";
}

/** 레이아웃 트리(확정형, 04장 4.5.2). 상세 타입은 @tastefit/layout-schema. */
export interface LayoutTreeLike {
  sections: {
    id: string;
    block: string;
    variant: string;
    role_overrides?: Record<string, string>;
  }[];
  [k: string]: unknown;
}
