// 03장 3.9 아이콘 인라인 SVG(ASM-026 ①, ASM-049). 순수 문자열(isomorphic).
// 3.9.1이 정한 패키지(@phosphor-icons/core·@tabler/icons·iconoir)는 의존성 허용 목록(잠금) 밖이라
// 사람 결정 전까지 **임시 자체 도형**(24 그리드 선 아이콘, provenance temp)을 세 세트 이름으로 낸다(BLK-011).
// 세트 차이는 선 끝·이음 모양만 다르다. 실제 세트로 바꾸면 이 표(PATHS)만 교체한다.

export type IconSet = "phosphor" | "tabler" | "iconoir";
export const ICON_PROVENANCE = "temp" as const;

/** 의미 id(data/icons/map.json) → 24×24 선 도형(SVG 자식 마크업). */
export const PATHS: Readonly<Record<string, string>> = {
  "arrow-right": '<path d="M4 12h16M14 6l6 6-6 6"/>',
  "arrow-up-right": '<path d="M7 17L17 7M8 7h9v9"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  phone:
    '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a3 3 0 0 1-3 3A16 16 0 0 1 3 6a3 3 0 0 1 3-3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  "map-pin":
    '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  "shield-check":
    '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 2.8 3 6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  coffee:
    '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
  utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5v4h3v9"/>',
  store:
    '<path d="M4 9l1.5-5h13L20 9M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11zM5 13v8h14v-8M10 21v-5h4v5"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
  brush: '<path d="M20 4l-9 9M11 13c-2.5-.5-5 1-5 4 0 1.5-1 2.5-2 3 3.5.5 8-1 7-7z"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8"/>',
  package: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9"/>',
  truck:
    '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  heart: '<path d="M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11z"/>',
  quote: '<path d="M10 7H6v5h4v-1c0 3-1.5 5-4 6M19 7h-4v5h4v-1c0 3-1.5 5-4 6"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  "warning-circle": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  car: '<path d="M4 16v-4l2-5h12l2 5v4zM4 16v3h3v-3M17 16v3h3v-3M4 12h16"/><circle cx="8" cy="14" r=".5"/><circle cx="16" cy="14" r=".5"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.5"/>',
};

/** 세트별 선 끝·이음(임시 도형의 세트 구분). */
const STYLE: Readonly<Record<IconSet, { cap: string; join: string }>> = {
  phosphor: { cap: "round", join: "round" },
  tabler: { cap: "round", join: "round" },
  iconoir: { cap: "butt", join: "miter" },
};

/** 4.9.3: stroke = radius family 연동(sharp·soft 1.5, round·pill 2). */
export function iconStrokeFor(radiusFamily: string): number {
  return radiusFamily === "round" || radiusFamily === "pill" ? 2 : 1.5;
}

export function iconSvg(
  set: IconSet,
  id: string,
  opts: { strokeWidth: number; size?: number },
): string {
  const body = PATHS[id];
  if (body === undefined) throw new Error(`알 수 없는 아이콘 ${id}`);
  const st = STYLE[set];
  const size = opts.size ?? 24;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"` +
    ` fill="none" stroke="currentColor" stroke-width="${opts.strokeWidth}" stroke-linecap="${st.cap}"` +
    ` stroke-linejoin="${st.join}" aria-hidden="true" focusable="false"` +
    ` data-icon-set="${set}" data-icon-stroke="${opts.strokeWidth}" data-icon="${id}">${body}</svg>`
  );
}
