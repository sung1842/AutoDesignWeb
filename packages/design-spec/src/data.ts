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
  version: string;
  theme: "light" | "dark";
  palettes: string[];
  signatureIds: string[];
  defaultSignatureId: string;
  excludedVariants: string[];
  heroVariants: string[];
  preferredPatterns: Record<string, string[]>;
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
  /** 03장 blocks.json(20블록). */
  blocks: JsonObj[];
  /** 03장 3.10 이미지 팩 manifest(B8). 렌더러가 asset_id → 경로·크기·초점을 찾는다. */
  images: ImageEntry[];
  /** 03장 3.1.5a 텍스트 역할(B25, text-roles.json). */
  textRoles: JsonObj[];
  /** 03장 3.6.5 이미지 태그 전체(manifest 태그 합집합, orient.·tone. 제외). */
  imageTags: string[];
  /** 05장 정규화기 최신 버전(data/normalizers/<시즌>.json 파일명). */
  normalizerVersion: string;
}

export interface ImageEntry {
  id: string;
  path: string;
  width: number;
  height: number;
  focalPoint: [number, number];
  altKo: string;
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
    blocks: read<JsonObj>(root, "data/taxonomy/blocks.json").items,
    textRoles: read<JsonObj>(root, "data/taxonomy/text-roles.json").items,
    images: read<ImageEntry>(root, "data/images/manifest.json").items.map((m) => ({
      id: m.id,
      path: m.path,
      width: m.width,
      height: m.height,
      focalPoint: m.focalPoint,
      altKo: m.altKo,
    })),
    normalizerVersion:
      readdirSync(join(root, "data/normalizers"))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
        .sort()
        .at(-1) ?? "",
    imageTags: imageTagSet(read<JsonObj>(root, "data/images/manifest.json").items),
  };
}

function imageTagSet(items: JsonObj[]): string[] {
  const out = new Set<string>();
  for (const it of items) {
    const tags = Array.isArray(it.tags) ? it.tags : typeof it.tag === "string" ? [it.tag] : [];
    for (const t of tags)
      if (typeof t === "string" && !t.startsWith("orient.") && !t.startsWith("tone.")) out.add(t);
  }
  return [...out].sort();
}
