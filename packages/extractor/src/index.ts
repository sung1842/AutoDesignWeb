// 05장 5.5 특징 추출기(렌더 DOM + 픽셀 → Features). 9.1.3: 입력 = Playwright Page(구조 타입), 의존 = 없음.
import { collectDomFeatures, DOM_SPEC, type DomFeatures } from "./dom.js";
import { colorClusters, pixelFeatures, PIXEL_SPEC, type PixelFeatures } from "./pixels.js";

export const PACKAGE_NAME = "@tastefit/extractor";
export * from "./dom.js";
export * from "./pixels.js";
export * from "./phash.js";

/** 추출기 버전(정규화기 extractor_version과 대조, 5.8). */
export const EXTRACTOR_VERSION = "0.1.0";

export interface ExtractPage {
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  screenshot(opts: {
    clip: { x: number; y: number; width: number; height: number };
    fullPage: boolean;
  }): Promise<Uint8Array>;
}
/** PNG → 폭 width로 축소한 RGB(A) 바이트. worker가 sharp로 주입한다(추출기는 이미지 라이브러리에 의존하지 않음). */
export type DecodeResize = (
  png: Uint8Array,
  width: number,
) => Promise<{ data: Uint8Array; channels: number }>;

export type Features = Omit<DomFeatures, "areaH"> & {
  [K in keyof PixelFeatures]: PixelFeatures[K] | null;
} & { area_h: number };

export interface ExtractOptions {
  fontClasses: Record<string, string>;
  decode: DecodeResize;
}

/** 5.5.3 원시 특징 F01~F30(측정 불가 = null). 뷰포트는 호출자가 1280×800으로 연다(5.4.2). */
export async function extractFeatures(page: ExtractPage, o: ExtractOptions): Promise<Features> {
  // 5.4.2: 애니메이션 정착 후 측정(어느 경로로 불러도 같은 값, ASM-080 ②)
  await page.evaluate(() => {
    for (const a of document.getAnimations())
      try {
        a.finish();
      } catch {
        a.pause();
      }
  }, undefined);
  const dom = await page.evaluate(collectDomFeatures, {
    spec: DOM_SPEC,
    fontClasses: o.fontClasses,
  });
  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: DOM_SPEC.vpW, height: dom.areaH },
    fullPage: true,
  });
  const px = await o.decode(png, PIXEL_SPEC.width);
  const pf = pixelFeatures(colorClusters(px.data, px.channels));
  const { areaH, ...rest } = dom;
  return {
    ...rest,
    F14: pf?.F14 ?? null,
    F15: pf?.F15 ?? null,
    F19: pf?.F19 ?? null,
    F20: pf?.F20 ?? null,
    F21: pf?.F21 ?? null,
    F25: pf?.F25 ?? null,
    area_h: areaH,
  };
}
export * from "./l1.js";

/** 05장 5.5.3 원시 특징 = L2 측정(extractFeatures의 공개 이름, ASM-080 ②). L1 = toL1(extractL2(page), normalizer). */
export function extractL2(page: ExtractPage, o: ExtractOptions): Promise<Features> {
  return extractFeatures(page, o);
}
