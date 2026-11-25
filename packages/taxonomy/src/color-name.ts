// 03장 3.13.5 colorName(hex) — 순수 함수(서버·브라우저 공용, ASM-026 ⑧·ASM-062).
// 사전은 이 표가 원천이고 seed:temp가 같은 내용을 config/color-names.ko.json(provenance temp)으로 낸다.
import { hexToOklch } from "./color.js";

export interface ColorNameDef {
  name: string;
  /** 색상각 구간 [시작, 끝)(끝 < 시작이면 360을 넘어 감는다). */
  h: [number, number];
  /** 명도·채도 범위가 있으면 기본 색보다 먼저 매칭한다(갈색·베이지 등). 수식어를 붙이지 않는다. */
  l?: [number, number];
  c?: [number, number];
}

/** 기본 색 22(0~360 빈틈 없음) + 명도·채도 조건 색 20 = 42. 3.13.5 예시 구간을 따른다. */
export const COLOR_NAMES: readonly ColorNameDef[] = [
  { name: "다홍", h: [0, 15] },
  { name: "빨강", h: [15, 25] },
  { name: "주홍", h: [25, 35] },
  { name: "주황", h: [35, 50] },
  { name: "귤색", h: [50, 65] },
  { name: "호박색", h: [65, 80] },
  { name: "노랑", h: [80, 95] },
  { name: "레몬색", h: [95, 105] },
  { name: "연두", h: [105, 125] },
  { name: "초록", h: [125, 145] },
  { name: "풀색", h: [145, 165] },
  { name: "청록", h: [165, 185] },
  { name: "옥색", h: [185, 200] },
  { name: "하늘색", h: [200, 220] },
  { name: "파랑", h: [220, 245] },
  { name: "코발트", h: [245, 265] },
  { name: "남색", h: [265, 285] },
  { name: "보라", h: [285, 305] },
  { name: "자주", h: [305, 320] },
  { name: "자홍", h: [320, 330] },
  { name: "분홍", h: [330, 345] },
  { name: "장미색", h: [345, 360] },
  // 명도·채도 조건 색(우선 매칭)
  { name: "와인색", h: [355, 25], l: [0, 0.4], c: [0.06, 0.4] },
  { name: "갈색", h: [25, 75], l: [0, 0.55], c: [0.03, 0.16] },
  { name: "테라코타", h: [30, 50], l: [0.55, 0.68], c: [0.1, 0.2] },
  { name: "산호색", h: [20, 40], l: [0.68, 0.82], c: [0.12, 0.4] },
  { name: "살구색", h: [45, 65], l: [0.78, 0.92], c: [0.06, 0.16] },
  { name: "베이지", h: [55, 100], l: [0.8, 0.97], c: [0.03, 0.08] },
  { name: "모래색", h: [65, 95], l: [0.65, 0.8], c: [0.03, 0.09] },
  { name: "크림색", h: [85, 110], l: [0.9, 1.01], c: [0.03, 0.1] },
  { name: "겨자색", h: [80, 100], l: [0.6, 0.8], c: [0.1, 0.4] },
  { name: "카키", h: [95, 125], l: [0.4, 0.7], c: [0.03, 0.1] },
  { name: "올리브", h: [100, 130], l: [0, 0.4], c: [0.03, 0.16] },
  { name: "국방색", h: [125, 150], l: [0, 0.4], c: [0.03, 0.1] },
  { name: "민트", h: [160, 185], l: [0.8, 0.97], c: [0.03, 0.15] },
  { name: "청회색", h: [210, 260], l: [0.4, 0.8], c: [0.03, 0.06] },
  { name: "네이비", h: [245, 280], l: [0, 0.35], c: [0.04, 0.4] },
  { name: "라벤더", h: [285, 315], l: [0.75, 0.95], c: [0.03, 0.12] },
  { name: "가지색", h: [300, 330], l: [0, 0.35], c: [0.05, 0.4] },
  { name: "연분홍", h: [340, 20], l: [0.82, 0.97], c: [0.03, 0.1] },
  { name: "자두색", h: [330, 355], l: [0, 0.4], c: [0.06, 0.4] },
  { name: "황토색", h: [70, 90], l: [0.5, 0.65], c: [0.08, 0.16] },
];

const inH = (h: number, [a, b]: [number, number]): boolean =>
  a <= b ? h >= a && h < b : h >= a || h < b;
const inR = (x: number, r: [number, number] | undefined): boolean => !r || (x >= r[0] && x < r[1]);

/** 3.13.5 판정 상수(무채색 C 경계, 명도 단계, 수식어 경계). */
export const COLOR_NAME_SPEC = {
  achromaticC: 0.03,
  white: 0.95,
  lightGray: 0.8,
  gray: 0.45,
  darkGray: 0.2,
  lightL: 0.8,
  darkL: 0.4,
  dullC: 0.08,
  vividC: 0.2,
} as const;
const K = COLOR_NAME_SPEC;

/** 3.13.5 2단계: 무채색 이름. */
function achromatic(l: number): string {
  if (l >= K.white) return "흰색";
  if (l >= K.lightGray) return "밝은 회색";
  if (l >= K.gray) return "회색";
  if (l >= K.darkGray) return "짙은 회색";
  return "검정";
}

/** 3.13.5 수식어(최대 1개, 명도 > 채도). */
function modifier(l: number, c: number): string {
  if (l >= K.lightL) return "밝은 ";
  if (l < K.darkL) return "짙은 ";
  if (c < K.dullC) return "탁한 ";
  if (c >= K.vividC) return "선명한 ";
  return "";
}

export function colorName(hex: string, dict: readonly ColorNameDef[] = COLOR_NAMES): string {
  const { l, c, h } = hexToOklch(hex);
  if (c < K.achromaticC) return achromatic(l);
  const hue = ((h % 360) + 360) % 360;
  const special = dict.find((e) => (e.l || e.c) && inH(hue, e.h) && inR(l, e.l) && inR(c, e.c));
  if (special) return special.name;
  const base = dict.find((e) => !e.l && !e.c && inH(hue, e.h));
  return `${modifier(l, c)}${base?.name ?? "회색"}`;
}
