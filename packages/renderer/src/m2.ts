// 04장 4.9 결정론적 컴파일러(ASM-023·025·027). M2-05~07에서 채운다.
export { cssLiteralViolations, declarations } from "./css/literal.js";
export { rendererCssSources, stylesCss, type CssSource } from "./css/sources.js";
import { compilePageImpl, type PTree, type SpecLike } from "./compile.js";
import "./blocks/index.js";
import {
  DEFAULT_BRAND,
  resolveTree,
  standardTree,
  type Deck,
  type DesignData,
  type RawTree,
} from "@tastefit/design-spec";
import type { FontPlan } from "./fonts.js";
export * from "./fonts.js";
export * from "./media.js";
export * from "./compile.js";
export { esc } from "./html.js";
const pending = (n: string): never => {
  throw new Error(`${n}: M2-05~07에서 구현 예정`);
};
/** 04장 4.9 컴파일(ASM-025 ③·ASM-042). spec = DesignSpec, tree = 확정 PageSchema, data = DesignData. */
export function compilePage(
  spec: unknown,
  tree: unknown,
  data: unknown,
): { html: string; fonts: FontPlan } {
  return compilePageImpl(
    spec as SpecLike,
    tree as PTree,
    data as Parameters<typeof compilePageImpl>[2],
  );
}
export function compileForEdit(
  _tokens: unknown,
  _tree: unknown,
  _vw: number,
  _opts: { webOrigin: string; spec: unknown; data: unknown },
): { html: string } {
  void [_tokens, _tree, _vw, _opts];
  return pending("compileForEdit");
}
export function renderBlockSample(
  _input: {
    presetId: string;
    block: string;
    variant: string;
    purpose: string;
    copy: "max" | "typical";
  },
  _data: unknown,
): string | null {
  void [_input, _data];
  return pending("renderBlockSample");
}
export function renderComponentGallery(
  _presetId: string,
  _data: unknown,
  _opts: { copy: "max" | "typical" },
): { html: string; cases: string[] } {
  void [_presetId, _data, _opts];
  return pending("renderComponentGallery");
}
export function renderStepProbe(_spec: unknown, _data: unknown): string {
  void [_spec, _data];
  return pending("renderStepProbe");
}
export interface FixturePage {
  spec: { variant: string; tokens: Record<string, unknown> };
  tree: { sections: { role_overrides?: Record<string, string> }[] };
}
/** 9.4.4 ① 픽스처({purpose, typeId, raw, deck}) → 유형 앵커 명세 + 확정 트리(ASM-054). presetId면 그 프리셋 유형. */
export function fixturePage(
  fx: unknown,
  data: unknown,
  opts: { presetId?: string } = {},
): FixturePage {
  const f = fx as { purpose: string; typeId: string; raw: RawTree; deck: Deck };
  const d = data as DesignData;
  const typeId = opts.presetId
    ? (d.presets.find((p) => p.id === opts.presetId)?.typeId ?? f.typeId)
    : f.typeId;
  const { spec } = standardTree(typeId, f.purpose, d);
  const tree = resolveTree({ ...f.raw, spec_id: spec.spec_id }, d, {
    deck: f.deck,
    brand: DEFAULT_BRAND,
    seed: spec.spec_id,
    navVariant: spec.layout_constraints.allowed_variants.nav?.[0] ?? "nav.split",
    mediaMode: String(spec.l2["media.mode"]),
  });
  return { spec, tree } as unknown as FixturePage;
}
