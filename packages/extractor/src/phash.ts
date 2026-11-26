// 08장 8.3.3 pHash: 첫 화면 그레이스케일 DCT 64비트. 레퍼런스·생성 후보 모두 이 함수 하나로 계산한다(ASM-078 ③).
/** 축소 해상도와 저주파 블록(표준 pHash: 32×32 → DCT → 좌상단 8×8). */
export const PHASH_SPEC = { size: 32, block: 8, hexDigits: 16, nibbleBits: 4, bits: 64 } as const;
const N = PHASH_SPEC.size;
const K = PHASH_SPEC.block;

function grayResize(rgb: Uint8Array, w: number, h: number, ch: number): Float64Array {
  const out = new Float64Array(N * N);
  for (let y = 0; y < PHASH_SPEC.size; y++) {
    const y0 = Math.floor((y * h) / N);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / N));
    for (let x = 0; x < PHASH_SPEC.size; x++) {
      const x0 = Math.floor((x * w) / N);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / N));
      let s = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * w + xx) * ch;
          s += 0.299 * (rgb[o] ?? 0) + 0.587 * (rgb[o + 1] ?? 0) + 0.114 * (rgb[o + 2] ?? 0);
        }
      out[y * N + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

let COS: Float64Array | null = null;
function cosTable(): Float64Array {
  if (COS) return COS;
  COS = new Float64Array(K * N);
  for (let u = 0; u < PHASH_SPEC.block; u++)
    for (let x = 0; x < PHASH_SPEC.size; x++)
      COS[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
  return COS;
}

/** raw 픽셀(rgb/rgba, 행 우선) → 16자리 hex 64비트 pHash. */
export function phash64(rgb: Uint8Array, w: number, h: number, channels: number): string {
  const g = grayResize(rgb, w, h, channels);
  const c = cosTable();
  const coef: number[] = [];
  for (let v = 0; v < PHASH_SPEC.block; v++)
    for (let u = 0; u < PHASH_SPEC.block; u++) {
      let s = 0;
      for (let y = 0; y < PHASH_SPEC.size; y++)
        for (let x = 0; x < PHASH_SPEC.size; x++)
          s += (g[y * N + x] ?? 0) * (c[u * N + x] ?? 0) * (c[v * N + y] ?? 0);
      coef.push(s);
    }
  // DC(0,0)를 뺀 63개의 중앙값 기준
  const med = [...coef.slice(1)].sort((a, b) => a - b)[Math.floor((coef.length - 1) / 2)] ?? 0;
  let hex = "";
  for (let i = 0; i < PHASH_SPEC.bits; i += PHASH_SPEC.nibbleBits) {
    let nib = 0;
    for (let b = 0; b < PHASH_SPEC.nibbleBits; b++)
      nib = (nib << 1) | ((coef[i + b] ?? 0) > med ? 1 : 0);
    hex += nib.toString(16);
  }
  return hex;
}

/** 두 64비트 hex 해시의 해밍 거리. */
export function hamming64(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < PHASH_SPEC.hexDigits; i++) {
    let x = parseInt(a[i] ?? "0", 16) ^ parseInt(b[i] ?? "0", 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}
