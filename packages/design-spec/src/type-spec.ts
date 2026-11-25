// 03장 3.1.5 타입 스케일 상수(순수, isomorphic. tokens·tokens-css 공용).
/** 3.1.5 공식 상수: boost 적용 단계·상한(base 배수)·모바일 상한 px·음수 단계 하한·보간 기준 뷰포트. */
export const TYPE_SPEC = {
  boostFrom: 5,
  h1MaxX: 6,
  displayMaxX: 8,
  mobileH1Max: 44,
  mobileDisplayMax: 52,
  minNegPx: 12,
  mobileBaseMin: 16,
  vwMobile: 375,
  vwDesktop: 1280,
} as const;
