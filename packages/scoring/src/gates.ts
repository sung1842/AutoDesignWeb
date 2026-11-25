// 04장 4.10.2 하드 게이트 판정(9.4.4 ②, ASM-025 ②·ASM-055). 입력 = worker 하네스 측정값(PageMeasure).
// 구현: G-02 텍스트 대비, G-03 비텍스트 대비, G-04 가로 넘침, G-05 텍스트 잘림, G-06 겹침, G-07 리소스. 나머지 id는 "미구현"으로 실패를 낸다.
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
