// 디자인 데이터 로더(ASM-023 ①). 03장 산출 파일을 한 번에 읽어 매핑·토큰·명세서 컴파일러가 공유한다.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MapData, PaletteLite, PresetLite, TaxKey } from "@tastefit/taxonomy";

export interface PaletteRole {
  oklch: [number, number, number];
  hex: string;
}
export interface Palette extends PaletteLite {
  typeId: string;
  index: number;
  theme: "light" | "dark";
  roles: Record<string, PaletteRole>;
}
export interface Preset extends PresetLite {
  theme: "light" | "dark";
  palettes: string[];
  signatureIds: string[];
  defaultSignatureId: string;
  excludedVariants: string[];
  buttonPill: boolean;
  tokens: { typeScale: Record<string, [number, number]>; displayToBody: number };
}
export interface ColorNameEntry {
  name: string;
  h: [number, number];
}
export type JsonObj = { [k: string]: unknown };
export interface FontEntry {
  id: string;
  code: string;
  family: string;
  script: string;
  classification: string;
  subsetFamily: string;
}
export interface PairingFull {
  code: string;
  headingFontId: string;
  bodyFontId: string;
  headingLatinFontId?: string | null;
  labelFontId?: string | null;
  headlineWeights: string[];
  defaultHeadlineWeight: string;
  emphasisWeight: number;
  classHeading: string;
  classBody: string;
  contrastSerif: boolean;
  sig: { temp: number; expr: number; soft: number };
}
export interface DesignData extends MapData {
  taxonomyVersion: string;
  taxonomy: TaxKey[];
  palettes: Palette[];
  presets: Preset[];
  signatures: JsonObj[];
  harmony: JsonObj[];
  purposes: JsonObj[];
  colorNames: ColorNameEntry[];
  fonts: FontEntry[];
  pairingsFull: PairingFull[];
}

interface Envelope<T> {
  taxonomyVersion?: string;
  items: T[];
}
const read = <T>(root: string, rel: string): Envelope<T> =>
  JSON.parse(readFileSync(join(root, rel), "utf8")) as Envelope<T>;

/** 저장소 루트에서 03장 데이터를 읽는다. 프리셋 순서는 PS-T1~T8. */
export function loadDesignData(root: string): DesignData {
  const tax = read<TaxKey>(root, "data/taxonomy/taxonomy.json");
  const presetDir = join(root, "data/taxonomy/presets");
  const presets = readdirSync(presetDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => read<Preset>(root, `data/taxonomy/presets/${f}`).items);
  return {
    taxonomyVersion: tax.taxonomyVersion ?? "",
    taxonomy: tax.items,
    mapping: read<MapData["mapping"][number]>(root, "data/taxonomy/mapping.json").items,
    pairings: read<MapData["pairings"][number]>(root, "data/fonts/pairings.json").items,
    palettes: read<Palette>(root, "data/taxonomy/palettes.json").items,
    presets,
    signatures: read<JsonObj>(root, "data/taxonomy/signatures.json").items,
    harmony: read<JsonObj>(root, "data/taxonomy/harmony.json").items,
    purposes: read<JsonObj>(root, "data/taxonomy/purposes.json").items,
    colorNames: [],
    fonts: read<FontEntry>(root, "data/fonts/registry.json").items,
    pairingsFull: read<PairingFull>(root, "data/fonts/pairings.json").items,
  };
}
