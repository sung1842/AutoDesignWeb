// 04장 4.9 결정론적 컴파일러(ASM-023·025·027). M2-05~07에서 채운다.
export { cssLiteralViolations, declarations } from "./css/literal.js";
export { rendererCssSources, stylesCss, type CssSource } from "./css/sources.js";
import { compilePageImpl, type DataLike, type PTree, type SpecLike } from "./compile.js";
import "./blocks/index.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderComponentGalleryImpl } from "./gallery.js";
export { forcedStateCss } from "./gallery.js";
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
import { renderBlockSampleImpl, renderStepProbeImpl, type SampleInput } from "./samples.js";
export { maxDeck, maxText } from "./samples.js";
export * from "./compile.js";
export { esc } from "./html.js";
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
/** 6.11.4 (b) 편집 미리보기 srcdoc: 편집 토큰으로 컴파일하고 <head> 첫 요소로 CSP meta를 넣는다(ASM-059). */
export function editCsp(webOrigin: string): string {
  return `default-src 'none'; style-src 'unsafe-inline'; img-src ${webOrigin} data:; font-src ${webOrigin}; base-uri 'none'; form-action 'none'`;
}
export function compileForEdit(
  tokens: unknown,
  tree: unknown,
  _vw: number,
  opts: { webOrigin: string; spec: unknown; data: unknown },
): { html: string } {
  void _vw;
  const spec = { ...(opts.spec as SpecLike), tokens: tokens as Record<string, unknown> };
  const { html } = compilePageImpl(
    spec,
    tree as PTree,
    opts.data as Parameters<typeof compilePageImpl>[2],
  );
  const meta = `<meta http-equiv="Content-Security-Policy" content="${editCsp(opts.webOrigin)}">`;
  return { html: html.replace("<head>", `<head>${meta}`) };
}
export function renderBlockSample(input: SampleInput, data: unknown): string | null {
  return renderBlockSampleImpl(input, data as DesignData);
}
/** AC-03-15·17·46 컴포넌트 갤러리(ASM-061). 명세 = 프리셋 유형 표준 명세(saas). */
export function renderComponentGallery(
  presetId: string,
  data: unknown,
  opts: { copy: "max" | "typical" },
): { html: string; cases: string[] } {
  const d = data as DesignData;
  const p = d.presets.find((x) => x.id === presetId);
  if (!p) throw new Error(`프리셋 없음 ${presetId}`);
  const { spec } = standardTree(p.typeId, "saas", d);
  const comps = (
    JSON.parse(readFileSync(join(d.root, "data/taxonomy/components.json"), "utf8")) as {
      items: Parameters<typeof renderComponentGalleryImpl>[2];
    }
  ).items;
  return renderComponentGalleryImpl(
    spec as unknown as SpecLike,
    d as unknown as DataLike,
    comps,
    opts.copy,
  );
}
export function renderStepProbe(spec: unknown, _data: unknown): string {
  void _data;
  return renderStepProbeImpl(spec as SpecLike);
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
