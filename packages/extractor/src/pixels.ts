// 05장 5.5.1 픽셀 기반 색: 축소 이미지 → OKLab → k-means(k=8, k-means++, 시드 42, 최대 50회) → ΔE_OK < 0.04 병합.
// 순수 함수(입력 = RGB(A) 바이트). F14·F15·F19·F20·F21·F25를 만든다.

/** 5.5.1 픽셀 색 상수(사양 값 그대로). */
export const PIXEL_SPEC = {
  width: 320,
  k: 8,
  seed: 42,
  maxIter: 50,
  mergeDeltaE: 0.04,
  minShare: 0.01,
  warmHueDeg: 50,
  chromaFloor: 0.02,
  darkL: 0.35,
} as const;

export interface Cluster {
  lab: [number, number, number];
  share: number;
}

const ungamma = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [ungamma(r), ungamma(g), ungamma(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** mulberry32(결정적 PRNG). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const d2 = (p: Float64Array, i: number, c: readonly number[]): number => {
  const x = (p[i * 3] ?? 0) - (c[0] ?? 0);
  const y = (p[i * 3 + 1] ?? 0) - (c[1] ?? 0);
  const z = (p[i * 3 + 2] ?? 0) - (c[2] ?? 0);
  return x * x + y * y + z * z;
};

/** RGB(A) 바이트 → 병합 후 군집(면적 비율 내림차순). 같은 입력 = 같은 출력. */
export function colorClusters(data: Uint8Array, channels: number): Cluster[] {
  const n = Math.floor(data.length / channels);
  if (n === 0) return [];
  // 같은 색은 한 번만 변환(캐시)
  const pts = new Float64Array(n * 3);
  const cache = new Map<number, [number, number, number]>();
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const key = ((data[o] ?? 0) << 16) | ((data[o + 1] ?? 0) << 8) | (data[o + 2] ?? 0);
    let lab = cache.get(key);
    if (!lab) {
      lab = rgbToOklab(data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0);
      cache.set(key, lab);
    }
    pts[i * 3] = lab[0];
    pts[i * 3 + 1] = lab[1];
    pts[i * 3 + 2] = lab[2];
  }
  const rnd = prng(PIXEL_SPEC.seed);
  const k = Math.min(PIXEL_SPEC.k, cache.size);
  // k-means++ 초기화
  const cents: number[][] = [];
  const first = Math.floor(rnd() * n);
  cents.push([pts[first * 3] ?? 0, pts[first * 3 + 1] ?? 0, pts[first * 3 + 2] ?? 0]);
  const dist = new Float64Array(n).fill(Infinity);
  while (cents.length < k) {
    const c = cents[cents.length - 1]!;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.min(dist[i] ?? Infinity, d2(pts, i, c));
      dist[i] = v;
      sum += v;
    }
    if (sum === 0) break;
    let r = rnd() * sum;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      r -= dist[i] ?? 0;
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    cents.push([pts[pick * 3] ?? 0, pts[pick * 3 + 1] ?? 0, pts[pick * 3 + 2] ?? 0]);
  }
  const assign = new Int32Array(n).fill(-1);
  for (let it = 0; it < PIXEL_SPEC.maxIter; it++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < cents.length; j++) {
        const v = d2(pts, i, cents[j]!);
        if (v < bd) {
          bd = v;
          best = j;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed++;
      }
    }
    const acc = cents.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const a = acc[assign[i] ?? 0]!;
      a[0]! += pts[i * 3] ?? 0;
      a[1]! += pts[i * 3 + 1] ?? 0;
      a[2]! += pts[i * 3 + 2] ?? 0;
      a[3]! += 1;
    }
    for (let j = 0; j < cents.length; j++) {
      const a = acc[j]!;
      if ((a[3] ?? 0) > 0) cents[j] = [a[0]! / a[3]!, a[1]! / a[3]!, a[2]! / a[3]!];
    }
    if (changed === 0) break;
  }
  const counts = cents.map(() => 0);
  for (let i = 0; i < n; i++) counts[assign[i] ?? 0]! += 1;
  let cl: Cluster[] = cents
    .map((c, j) => ({
      lab: [c[0]!, c[1]!, c[2]!] as [number, number, number],
      share: counts[j]! / n,
    }))
    .filter((c) => c.share > 0);
  // ΔE_OK < 0.04 군집 병합(가장 가까운 쌍부터, 면적 가중 평균)
  for (;;) {
    let bi = -1;
    let bj = -1;
    let bd: number = PIXEL_SPEC.mergeDeltaE;
    for (let i = 0; i < cl.length; i++)
      for (let j = i + 1; j < cl.length; j++) {
        const a = cl[i]!.lab;
        const b = cl[j]!.lab;
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    if (bi < 0) break;
    const a = cl[bi]!;
    const b = cl[bj]!;
    const s = a.share + b.share;
    const lab = [0, 1, 2].map((q) => (a.lab[q]! * a.share + b.lab[q]! * b.share) / s) as [
      number,
      number,
      number,
    ];
    cl = cl.filter((_, q) => q !== bi && q !== bj);
    cl.push({ lab, share: s });
  }
  return cl.sort((x, y) => y.share - x.share || x.lab[0] - y.lab[0]);
}

export interface PixelFeatures {
  F14: number;
  F15: number;
  F19: number;
  F20: number;
  F21: number;
  F25: boolean;
}

/** 5.5.3 픽셀 특징. 군집이 없으면 null. */
export function pixelFeatures(cl: readonly Cluster[]): PixelFeatures | null {
  if (cl.length === 0) return null;
  const lch = cl.map((c) => {
    const C = Math.hypot(c.lab[1], c.lab[2]);
    const h = Math.atan2(c.lab[2], c.lab[1]);
    return { L: c.lab[0], C, h, b: c.lab[2], a: c.share };
  });
  const warm = (PIXEL_SPEC.warmHueDeg * Math.PI) / 180;
  const num = lch.reduce((s, x) => s + x.a * x.C * Math.cos(x.h - warm), 0);
  const den = lch.reduce((s, x) => s + x.a * Math.max(x.C, PIXEL_SPEC.chromaFloor), 0);
  const big = lch.filter((x) => x.a >= PIXEL_SPEC.minShare);
  const top = lch[0]!;
  return {
    F14: den > 0 ? num / den : 0,
    F15: top.b,
    F19: lch.reduce((s, x) => s + x.a * x.C, 0),
    F20: big.reduce((m, x) => Math.max(m, x.C), 0),
    F21: big.length,
    F25: top.L < PIXEL_SPEC.darkL,
  };
}
