// 02장 2.4.5 설문 자극물 자산: PNG → WebP(q 고정), 데스크톱 자산 OKLab k-means 면적 상위 3색(ASM-094).
import sharp from "sharp";
import { colorClusters, PIXEL_SPEC } from "@tastefit/extractor";

/** 2.4.5 표: 뷰포트·출력·품질. */
export const SURVEY_RENDER = {
  desktop: { w: 1280, h: 800, dpr: 1, quality: 80 },
  mobile: { w: 390, h: 780, dpr: 2, quality: 78 },
} as const;
export type SurveyDevice = keyof typeof SURVEY_RENDER;

/** WebP 인코딩(결정적: 같은 PNG·같은 libvips = 같은 바이트). */
export async function encodeWebp(png: Buffer, device: SurveyDevice): Promise<Buffer> {
  return sharp(png)
    .removeAlpha()
    .webp({ quality: SURVEY_RENDER[device].quality, effort: 4, smartSubsample: false })
    .toBuffer();
}

export async function webpSize(b: Buffer): Promise<{ w: number; h: number }> {
  const m = await sharp(b).metadata();
  return { w: m.width ?? 0, h: m.height ?? 0 };
}

const gamma = (c: number): number => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
};
/** OKLab → sRGB 대문자 HEX. */
export function oklabHex([L, a, b]: readonly [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(gamma);
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** 데스크톱 자산 → 면적 상위 3색(5.5.1 군집, 320px 축소). 군집이 3개 미만이면 마지막 색을 반복(ASM-094). */
export async function dominantColors(png: Buffer): Promise<[string, string, string]> {
  const { data, info } = await sharp(png)
    .resize({ width: PIXEL_SPEC.width, kernel: "nearest" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hex = colorClusters(data, info.channels).map((c) => oklabHex(c.lab));
  const uniq = [...new Set(hex)];
  const last = uniq.at(-1) ?? "#000000";
  return [uniq[0] ?? last, uniq[1] ?? last, uniq[2] ?? last];
}
