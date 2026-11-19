// M2 진행 중 자리표시: 구현 단위가 끝나면 이 파일에서 하나씩 지운다(PROGRESS M2 하위 단위).
export function todo(unit: string, name: string): never {
  throw new Error(`${name}: ${unit}에서 구현 예정`);
}
