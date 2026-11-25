import { describe, expect, it } from "vitest";
import { evaluateGates, IMPLEMENTED_GATES } from "./index.js";

const REF = {
  colors: [
    { name: "color.fg", hex: "#0F0F0F", alpha: 1 },
    { name: "color.overlay", hex: "#0A0A0A", alpha: 0.35 },
  ],
  radii: [0, 8, 999],
  spaces: [0, 4, 8, 12, 16],
  fontSizes: { "t-body": 16, "t-lead": 18.4 },
  tolerancePx: 0.5,
  deltaEOk: 0.01,
};

describe("하드 게이트 판정(4.10.2, ASM-055)", () => {
  it("측정값이 깨끗하면 구현 게이트 전부 통과", () => {
    const m = {
      scrollWidth: 375,
      innerWidth: 375,
      texts: [{ sel: "a", text: "x", ratio: 4.5, large: false }],
      integrity: { ref: REF, drift: [] },
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
  it("G-03 비텍스트 3:1", () => {
    const r = evaluateGates(
      {
        ui: [
          { sel: "a", kind: "focus", ratio: 2.99 },
          { sel: "b", kind: "input-edge", ratio: 3 },
        ],
      },
      ["G-03"],
    )[0]!;
    expect(r.violations).toHaveLength(1);
  });
  it("G-12·AIL-17: 스케일 밖 값·토큰 밖 색·deriveTokens 불일치(ASM-065)", () => {
    const styles = {
      fonts: [
        { sel: "a", role: "body", px: 16.3 },
        { sel: "b", role: "lead", px: 18.4 },
        { sel: "c", role: null, px: 15 },
      ],
      colors: [
        { sel: "a", prop: "color", rgba: [15, 15, 15, 1] as [number, number, number, number] },
        {
          sel: "o",
          prop: "background-color",
          rgba: [10, 10, 10, 0.35] as [number, number, number, number],
        },
        { sel: "x", prop: "color", rgba: [255, 0, 0, 1] as [number, number, number, number] },
      ],
      radii: [
        { sel: "r", prop: "r", px: 8 },
        { sel: "q", prop: "r", px: 6 },
      ],
      spaces: [
        { sel: "p", prop: "padding-top", px: 16 },
        { sel: "n", prop: "margin-top", px: -8 },
        { sel: "z", prop: "padding-left", px: 13 },
      ],
    };
    const [g12, ail] = evaluateGates({ styles, integrity: { ref: REF, drift: ["color.bg"] } }, [
      "G-12",
      "AIL-17",
    ]);
    expect(ail!.violations).toHaveLength(4); // 15px·빨강·6px·13px
    expect(g12!.violations).toHaveLength(5); // + color.bg 불일치
    expect(evaluateGates({ styles }, ["AIL-17"])[0]!.pass).toBe(false); // spec 없음
  });
});
