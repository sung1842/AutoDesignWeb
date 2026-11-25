// OKLCH ↔ sRGB hex, WCAG 대비(03장 3.1.3 "hex 반올림 후 값 기준, 소수 둘째 자리 내림 비교").
// 순수 함수만 둔다. 팔레트 해석(03장 3.4.3 "색역 밖이면 C를 0.005씩 낮춘다")과 04장 deriveTokens가 함께 쓴다.

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const EPS = 1e-7;

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const gamma = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const ungamma = (x: number): number => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

export function inGamut(c: Oklch): boolean {
  return oklchToLinear(c).every((v) => v >= -EPS && v <= 1 + EPS);
}

/** 색역 밖이면 C를 step씩 낮춘다(03장 3.4.3). 반환값의 c는 실제 쓴 C. */
export function fitGamut(c: Oklch, step = 0.005): Oklch {
  let cur = { ...c };
  while (!inGamut(cur) && cur.c > 0) {
    cur = { ...cur, c: Math.max(0, Math.round((cur.c - step) * 1e6) / 1e6) };
  }
  return cur;
}

export function oklchToHex(c: Oklch): string {
  const rgb = oklchToLinear(c).map((v) =>
    Math.round(Math.min(1, Math.max(0, gamma(Math.min(1, Math.max(0, v))))) * 255),
  );
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

export function relLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ungamma(v / 255));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG 2.x 대비. 소수 둘째 자리 내림(4.499 → 4.49). */
export function contrast(a: string, b: string): number {
  const [x, y] = [relLuminance(a), relLuminance(b)].sort((p, q) => q - p);
  const r = ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
  return Math.floor(r * 100) / 100;
}

/** "L C H" 문자열(예: ".48 .15 258", "1 0 0") → Oklch. */
export function parseOklch(s: string): Oklch {
  const [l, c, h] = s.trim().split(/\s+/).map(Number);
  if ([l, c, h].some((v) => v === undefined || Number.isNaN(v)))
    throw new Error(`OKLCH 형식 오류: ${s}`);
  return { l: l ?? 0, c: c ?? 0, h: h ?? 0 };
}

/** sRGB hex → OKLab [L, a, b]. */
export function hexToOklab(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ungamma(v / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** sRGB hex → OKLCH(h 0~360, 무채색이면 h = 0). */
export function hexToOklch(hex: string): Oklch {
  const [l, a, b] = hexToOklab(hex);
  const c = Math.hypot(a, b);
  const h = c < 1e-6 ? 0 : ((((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
  return { l, c, h };
}

/** ΔE_OK: OKLab 유클리드 거리. */
export function deltaEOk(a: string, b: string): number {
  const [x, y] = [hexToOklab(a), hexToOklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
