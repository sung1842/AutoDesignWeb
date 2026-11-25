// M2 계약(ASM-023·024·025): DesignSpec zod·TokenSet·묶음 검증. M2-03에서 채운다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { MiniValidator, type Schema } from "./json-schema.js";

const repoFile = (rel: string): string =>
  fileURLToPath(new URL(`../../../${rel}`, import.meta.url));

/** 03장 taxonomy.json에서 l2 zod를 단방향 생성(AC-03-06): 18키, 값은 enum. */
function l2Schema() {
  const tax = JSON.parse(readFileSync(repoFile("data/taxonomy/taxonomy.json"), "utf8")) as {
    items: { id: string; values: string[] }[];
  };
  const shape: Record<string, z.ZodEnum> = {};
  for (const k of tax.items) shape[k.id] = z.enum(k.values as [string, ...string[]]);
  return z.object(shape).strict();
}

const unit = z.number().min(0).max(1);
const Vec5 = z
  .object({ expression: unit, temperature: unit, shape: unit, density: unit, depth: unit })
  .strict();
const AxisId = z.enum(["expression", "temperature", "shape", "density", "depth"]);
const TypeId = z.enum(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]);
const ids = z.array(z.string().min(1));

/** 04장 4.2.1 DesignSpec(ASM-037). */
export const DesignSpecSchema = z
  .object({
    spec_version: z.literal("1"),
    spec_id: z.string().regex(/^[0-9a-f]{16}$/),
    variant: z.enum(["v_true", "v_fit", "v_bal"]),
    taxonomy_version: z.string().min(1),
    preset_version: z.string().regex(/^\d{4}-S\d+(\.\d+)?$/),
    normalizer_version: z.string().regex(/^\d{4}-S\d+(\.\d+)?$/),
    type_id: TypeId,
    diagnosed_type_id: TypeId,
    purpose: z.enum(["saas", "portfolio", "local_business"]),
    theme: z.enum(["light", "dark"]),
    target_vector: Vec5,
    calibration_trace: z
      .object({
        mu: Vec5,
        sigma: z
          .object({
            expression: z.number(),
            temperature: z.number(),
            shape: z.number(),
            density: z.number(),
            depth: z.number(),
          })
          .strict(),
        kappa: z.number(),
        insensitive_axes: z.array(AxisId),
        anchor: Vec5,
        type_range: z
          .object({ lo: z.record(AxisId, z.number()), hi: z.record(AxisId, z.number()) })
          .strict(),
        g: z.record(AxisId, z.number()),
        v1: Vec5,
        alpha: z.number().min(0).max(1),
        v2: Vec5,
        distance_enforced: z.boolean(),
        moved_axes: z.array(
          z
            .object({
              axis: AxisId,
              from: z.number(),
              to: z.number(),
              reason: z.enum(["type", "purpose", "distance"]),
            })
            .strict(),
        ),
      })
      .strict(),
    l2: l2Schema(),
    tokens: z.record(z.string(), z.unknown()),
    layout_constraints: z
      .object({
        section_count: z
          .object({ min: z.number().int().min(1), max: z.number().int().min(1) })
          .strict(),
        required_blocks: ids,
        optional_blocks: ids,
        forbidden_blocks: ids,
        allowed_variants: z.record(z.string(), ids),
        hero_variants: ids.min(1),
        pattern_slots: z.tuple([z.string().min(1), z.string().min(1)]),
        rhythm: z
          .object({
            max_centered_ratio: z.literal(0.4),
            inverse_sections: z.tuple([z.literal(1), z.literal(2)]),
            max_same_bg_run: z.literal(2),
            forbid_strict_alternation: z.literal(true),
            pad_variation_min: z.literal(1),
          })
          .strict(),
        image_tags_allowed: ids.min(1),
      })
      .strict(),
    copy: z
      .object({
        tone_id: z.enum(["T-PRECISE", "T-WARM", "T-EDITORIAL", "T-PLAYFUL"]),
        ending: z.enum(["hamnida", "haeyo", "plain"]),
        headline_option_preference: z.array(z.enum(["factual", "benefit", "emotive"])),
        exclaim_max_per_page: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
    signature: z
      .object({
        id: z
          .string()
          .regex(/^SIG-(0[1-9]|1[0-2])$/)
          .refine((x) => x !== "SIG-05"),
        intensity: z.union([z.literal(1), z.literal(2)]),
        apply_to: ids.min(1),
      })
      .strict(),
    decor: z
      .object({
        effects: z.array(
          z.enum([
            "grain",
            "glass",
            "brutal-offset",
            "oversized-type",
            "outline-text",
            "grid-pattern",
            "duotone",
            "marquee",
          ]),
        ),
        max: z.union([z.literal(1), z.literal(2)]),
      })
      .strict(),
    forbidden: z.object({ lint_rules_strict: ids, conflict_ids: ids }).strict(),
    brand_color: z
      .object({
        hex_in: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        hue_locked: z.number(),
        role: z.enum(["primary", "accent"]),
        adjusted_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        delta_e_ok: z.number().min(0),
      })
      .strict()
      .nullable(),
    brand_color_notice: z
      .enum(["adjusted", "demoted_to_accent", "used_as_tint", "ignored"])
      .nullable(),
  })
  .strict();

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
const pending = (name: string): ValidationResult => ({
  ok: false,
  errors: [`${name}: M2-03에서 구현 예정`],
});

/** data/tokens/schema.json(tokens-1) 검증. */
let tokenSchema: { v: MiniValidator; s: Schema } | null = null;
function loadTokenSchema(): { v: MiniValidator; s: Schema } {
  if (tokenSchema) return tokenSchema;
  // src·dist 어디서든 패키지 위 두 단계가 저장소 루트
  const p = repoFile("data/tokens/schema.json");
  const env = JSON.parse(readFileSync(p, "utf8")) as { items: { id: string; schema: Schema }[] };
  const item = env.items.find((i) => i.id === "tokens-1");
  if (!item || typeof item.schema !== "object") throw new Error("tokens-1 스키마 없음");
  tokenSchema = { v: new MiniValidator(item.schema), s: item.schema };
  return tokenSchema;
}
export function validateTokenSet(x: unknown): ValidationResult {
  const { v, s } = loadTokenSchema();
  const errors = v.validate(s, x);
  return { ok: errors.length === 0, errors };
}
/** 묶음 파일 하나를 경로로 골라 zod 검증. */
export function validateBundle(_path: string, _json: unknown): ValidationResult {
  void [_path, _json];
  return pending("validateBundle");
}
