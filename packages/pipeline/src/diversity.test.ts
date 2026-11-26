import { describe, expect, it } from "vitest";
import { diversityViolations, seqDistance } from "./diversity.js";

const s = (index: number, hero: string, blocks: string[]) => ({ index, hero, blocks });
describe("4.8 다양성 조건", () => {
  it("정규화 편집 거리", () => {
    expect(seqDistance(["a", "b", "c"], ["a", "b", "c"])).toBe(0);
    expect(seqDistance(["a", "b"], ["b", "a"])).toBe(1);
    expect(seqDistance([], [])).toBe(0);
  });
  it("같은 변형 쌍의 hero 같음·시퀀스 유사, 잡 내 완전 일치는 뒤쪽 인덱스에 표시", () => {
    const v = diversityViolations(
      [
        s(0, "hero.split", ["hero", "a", "b", "c"]),
        s(1, "hero.split", ["hero", "a", "b", "c"]),
        s(2, "hero.type-only", ["hero", "x", "y", "z"]),
        s(3, "hero.left-aligned", ["hero", "z", "y", "x"]),
        s(4, "hero.full-bleed-image", ["hero", "x", "y", "z"]),
        null,
      ],
      4,
    );
    expect([...v.keys()].sort()).toEqual([1, 4]);
    expect(
      v
        .get(1)
        ?.map((x) => x.rule)
        .sort(),
    ).toEqual(["DIV-HERO", "DIV-SEQ"]);
    expect(v.get(4)?.map((x) => x.rule)).toEqual(["DIV-DUP"]);
  });
  it("hero 종류 부족이면 뒤쪽 중복 hero 후보에 표시(허용 목록 크기로 상한)", () => {
    const items = [0, 1, 2, 3, 4, 5].map((i) =>
      s(i, i % 2 ? "hero.a" : "hero.b", ["hero", `p${i}`, `q${i}`, `r${i}`]),
    );
    const v = diversityViolations(items, 3);
    expect([...v.values()].flat().filter((x) => x.rule === "DIV-HERO-KINDS")).toHaveLength(1);
    expect(diversityViolations(items, 2).size).toBe(0);
  });
});
