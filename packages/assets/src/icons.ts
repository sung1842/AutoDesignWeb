// 03장 3.9 아이콘 인라인 SVG(ASM-026 ①). M2-07에서 구현한다.
export type IconSet = "phosphor" | "tabler" | "iconoir";
export function iconSvg(_set: IconSet, _id: string, _opts: { strokeWidth: number }): string {
  void [_set, _id, _opts];
  throw new Error("iconSvg: M2-07에서 구현 예정");
}
