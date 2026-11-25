import { describe, expect, it } from "vitest";
import { evaluateGates, IMPLEMENTED_GATES } from "./index.js";

describe("하드 게이트 판정(4.10.2, ASM-055)", () => {
  it("측정값이 깨끗하면 구현 게이트 전부 통과", () => {
    const m = {
      scrollWidth: 375,
      innerWidth: 375,
      texts: [{ sel: "a", text: "x", ratio: 4.5, large: false }],
    };
    expect(evaluateGates(m, [...IMPLEMENTED_GATES]).every((g) => g.pass)).toBe(true);
  });
  it("위반을 잡는다: 대비(큰 글자 3:1 경계)·넘침·잘림·겹침·리소스", () => {
    const m = {
      scrollWidth: 400,
      innerWidth: 375,
      texts: [
        { sel: "a", text: "본문", ratio: 4.49, large: false },
        { sel: "b", text: "제목", ratio: 3.0, large: true },
        { sel: "c", text: "제목", ratio: 2.99, large: true },
      ],
      clipped: ["s:p"],
      overlaps: ["x × y"],
      brokenImages: ["/assets/images/x.svg"],
      externalRequests: ["https://cdn.example/x.js"],
    };
    const r = Object.fromEntries(
      evaluateGates(m, ["G-02", "G-04", "G-05", "G-06", "G-07"]).map((g) => [g.id, g]),
    );
    expect(r["G-02"]!.violations).toHaveLength(2);
    for (const id of ["G-04", "G-05", "G-06", "G-07"]) expect(r[id]!.pass, id).toBe(false);
    expect(r["G-07"]!.violations).toHaveLength(2);
  });
  it("미구현 게이트는 통과로 속이지 않는다", () => {
    expect(evaluateGates({}, ["G-11"])[0]!.pass).toBe(false);
  });
});
