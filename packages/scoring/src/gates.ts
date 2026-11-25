// 04장 4.10.2 하드 게이트 판정(9.4.4 ②, ASM-025 ②·ASM-055). 입력 = worker 하네스 측정값(PageMeasure).
// 구현: G-02 텍스트 대비, G-03 비텍스트 대비, G-04 가로 넘침, G-05 텍스트 잘림, G-06 겹침, G-07 리소스, G-12 명세 무결성·AIL-17(D) 스케일 밖 값. 나머지 id는 "미구현"으로 실패를 낸다.
import { thresholdNumber } from "@tastefit/config";

export interface GateResult {
  id: string;
  pass: boolean;
  violations: string[];
}
interface TextSampleLike {
  sel: string;
  text: string;
  ratio: number;
  large: boolean;
}
export interface MeasureLike {
  vw?: number;
  scrollWidth?: number;
  innerWidth?: number;
  texts?: TextSampleLike[];
  clipped?: string[];
  overlaps?: string[];
  brokenImages?: string[];
  fontErrors?: string[];
  failedRequests?: string[];
  consoleErrors?: string[];
  externalRequests?: string[];
  ui?: { sel: string; kind: string; ratio: number }[];
  styles?: {
    fonts: { sel: string; role: string | null; px: number }[];
    colors: { sel: string; prop: string; rgba: [number, number, number, number] }[];
    radii: { sel: string; prop: string; px: number }[];
    spaces: { sel: string; prop: string; px: number }[];
  };
  integrity?: {
    ref: {
      colors: { name: string; hex: string; alpha: number }[];
      radii: number[];
      spaces: number[];
      fontSizes: Record<string, number>;
      tolerancePx: number;
      deltaEOk: number;
    };
    drift: string[];
  };
}

// sRGB 8bit → OKLab(ΔE_OK 판정용, 04장 AIL-17)
const ungamma = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
function oklab(rgb: readonly number[]): [number, number, number] {
  const [r, g, b] = [ungamma(rgb[0] ?? 0), ungamma(rgb[1] ?? 0), ungamma(rgb[2] ?? 0)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const hexRgb = (hex: string): number[] => {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const near = (v: number, set: readonly number[], tol: number): boolean =>
  set.some((x) => Math.abs(Math.abs(v) - x) <= tol);

/** AIL-17과 G-12가 함께 쓰는 스케일 밖 값 판정(T-28, ASM-065). */
function scaleViolations(m: MeasureLike): string[] {
  const it = m.integrity;
  if (!it) return ["spec 없음: 기준 집합을 만들 수 없다"];
  const st = m.styles ?? { fonts: [], colors: [], radii: [], spaces: [] };
  const { ref } = it;
  const tol = ref.tolerancePx;
  const out: string[] = [];
  const sizes = Object.values(ref.fontSizes);
  for (const f of st.fonts)
    if (!near(f.px, sizes, tol))
      out.push(`font-size ${f.sel}${f.role ? `(${f.role})` : ""} ${f.px}px`);
  const tokLab = ref.colors.map((c) => ({ ...c, lab: oklab(hexRgb(c.hex)) }));
  for (const c of st.colors) {
    const lab = oklab(c.rgba);
    const ok = tokLab.some(
      (t) =>
        Math.hypot(lab[0] - t.lab[0], lab[1] - t.lab[1], lab[2] - t.lab[2]) <= ref.deltaEOk &&
        Math.abs(c.rgba[3] - t.alpha) <= ref.deltaEOk,
    );
    if (!ok)
      out.push(
        `${c.prop} ${c.sel} rgba(${c.rgba.map((x) => Math.round(x * 100) / 100).join(",")})`,
      );
  }
  for (const r of st.radii)
    if (!near(r.px, ref.radii, tol)) out.push(`${r.prop} ${r.sel} ${r.px}px`);
  for (const s of st.spaces)
    if (!near(s.px, ref.spaces, tol)) out.push(`${s.prop} ${s.sel} ${s.px}px`);
  return out;
}

const floor2 = (x: number): number => Math.floor(x * 100) / 100;

type Judge = (m: MeasureLike) => string[];
const JUDGES: Readonly<Record<string, Judge>> = {
  "G-02": (m) => {
    const body = thresholdNumber("generation.contrastBodyMin");
    const large = thresholdNumber("generation.contrastLargeMin");
    return (m.texts ?? [])
      .filter((t) => floor2(t.ratio) < (t.large ? large : body))
      .map((t) => `${t.sel} "${t.text}" ${floor2(t.ratio)} < ${t.large ? large : body}`);
  },
  // 비텍스트 3:1(WCAG 1.4.11) = contrastLargeMin과 같은 값을 쓴다(ASM-057)
  "G-03": (m) => {
    const min = thresholdNumber("generation.contrastLargeMin");
    return (m.ui ?? [])
      .filter((u) => floor2(u.ratio) < min)
      .map((u) => `${u.sel} ${u.kind} ${floor2(u.ratio)} < ${min}`);
  },
  "G-04": (m) =>
    (m.scrollWidth ?? 0) > (m.innerWidth ?? 0)
      ? [`scrollWidth ${m.scrollWidth ?? 0} > innerWidth ${m.innerWidth ?? 0}`]
      : [],
  "G-05": (m) => (m.clipped ?? []).map((s) => `잘림 ${s}`),
  "G-06": (m) => (m.overlaps ?? []).map((s) => `겹침 ${s}`),
  "G-07": (m) => [
    ...(m.brokenImages ?? []).map((s) => `깨진 이미지 ${s}`),
    ...(m.fontErrors ?? []).map((s) => `폰트 로드 실패 ${s}`),
    ...(m.failedRequests ?? []).map((s) => `404 ${s}`),
    ...(m.consoleErrors ?? []).map((s) => `콘솔 오류 ${s.slice(0, 80)}`),
    ...(m.externalRequests ?? []).map((s) => `외부 요청 ${s}`),
  ],
  // G-12 명세 무결성 = deriveTokens(l2) == tokens + AIL-17과 같은 스케일 판정(04장 4.10.2)
  "G-12": (m) => [
    ...(m.integrity?.drift ?? []).map((k) => `deriveTokens 불일치 ${k}`),
    ...scaleViolations(m),
  ],
  "AIL-17": (m) => scaleViolations(m),
};

export const IMPLEMENTED_GATES: readonly string[] = Object.keys(JUDGES);

export function evaluateGates(measure: unknown, ids: string[]): GateResult[] {
  const m = (measure ?? {}) as MeasureLike;
  return ids.map((id) => {
    const j = JUDGES[id];
    if (!j) return { id, pass: false, violations: [`${id} 미구현(M2-09 이후)`] };
    const v = j(m);
    return { id, pass: v.length === 0, violations: v };
  });
}

export function harmonyScore(_spec: unknown, _tree: unknown): { total: number } {
  void [_spec, _tree];
  throw new Error("harmonyScore: M3에서 구현 예정");
}
