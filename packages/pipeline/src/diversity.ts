// 04장 4.8 다양성 조건(T-18). 원시 트리(LayoutTreeRaw)의 hero variant·섹션 block 시퀀스만 본다(렌더 전, 결정론).
// 위반 후보만 재호출 1회(call_kind='diversity'). 위반 표시는 쌍·중복의 뒤쪽 인덱스에 둔다.

/** 4.8 사양 상수: 같은 변형 두 후보의 block 시퀀스 정규화 편집 거리 하한, 잡 hero variant 종류 하한. */
export const DIVERSITY_SPEC = { seqDistMin: 0.3, heroKindsMin: 3 } as const;

export interface SeqInfo {
  index: number;
  hero: string;
  blocks: string[];
}
export interface DiversityViolation {
  rule: "DIV-HERO" | "DIV-SEQ" | "DIV-DUP" | "DIV-HERO-KINDS";
  where: string;
  message: string;
  fix_hint: string;
}

/** 정규화 편집 거리 = Levenshtein / max(길이). */
export function seqDistance(a: readonly string[], b: readonly string[]): number {
  const n = Math.max(a.length, b.length);
  if (n === 0) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    prev = cur;
  }
  return (prev[b.length] ?? 0) / n;
}

/** 인덱스 → 위반 목록. items[i] = 후보 i(스키마 실패면 null). heroAllowed = 잡 허용 hero variant 수. */
export function diversityViolations(
  items: readonly (SeqInfo | null)[],
  heroAllowed: number,
): Map<number, DiversityViolation[]> {
  const out = new Map<number, DiversityViolation[]>();
  const add = (i: number, v: DiversityViolation): void => {
    out.set(i, [...(out.get(i) ?? []), v]);
  };
  const ok = items.filter((x): x is SeqInfo => x !== null);
  for (let v = 0; v * 2 + 1 < items.length; v++) {
    const a = items[v * 2];
    const b = items[v * 2 + 1];
    if (!a || !b) continue;
    if (a.hero === b.hero)
      add(b.index, {
        rule: "DIV-HERO",
        where: "sections[0]",
        message: `같은 변형 두 후보의 hero variant가 같다(${b.hero})`,
        fix_hint: "sections[0]의 variant를 hero_variants 중 다른 값으로 바꾼다",
      });
    if (seqDistance(a.blocks, b.blocks) < DIVERSITY_SPEC.seqDistMin)
      add(b.index, {
        rule: "DIV-SEQ",
        where: "sections[*]",
        message: "같은 변형 두 후보의 섹션 block 시퀀스가 너무 비슷하다",
        fix_hint: "패턴 슬롯의 섹션 순서 힌트를 따른다",
      });
  }
  for (let j = 0; j < ok.length; j++)
    for (let i = 0; i < j; i++) {
      const A = ok[i];
      const B = ok[j];
      if (!A || !B || out.has(B.index)) continue;
      if (A.blocks.join(">") === B.blocks.join(">"))
        add(B.index, {
          rule: "DIV-DUP",
          where: "sections[*]",
          message: `후보 ${A.index}와 block 시퀀스가 완전히 같다`,
          fix_hint: "패턴 슬롯의 섹션 순서 힌트를 따른다",
        });
    }
  const target = Math.min(DIVERSITY_SPEC.heroKindsMin, heroAllowed);
  const kinds = new Set(ok.map((x) => x.hero));
  let need = target - kinds.size;
  const seen = new Set<string>();
  const dupHero = ok.filter((x) => (seen.has(x.hero) ? true : (seen.add(x.hero), false)));
  for (const x of [...dupHero].reverse()) {
    if (need <= 0) break;
    if (out.has(x.index)) continue;
    add(x.index, {
      rule: "DIV-HERO-KINDS",
      where: "sections[0]",
      message: `잡 hero variant 종류가 ${kinds.size}종(최소 ${target})`,
      fix_hint: "sections[0]의 variant를 아직 쓰지 않은 hero_variants 값으로 바꾼다",
    });
    need--;
  }
  return out;
}
