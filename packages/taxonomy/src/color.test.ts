import { describe, expect, it } from "vitest";
import { contrast, fitGamut, inGamut, oklchToHex, parseOklch } from "./color.js";

describe("color (03장 3.1.3·3.4.2·3.4.3)", () => {
  it("3.4.2 표의 OKLCH가 표의 hex로 변환된다", () => {
    expect(oklchToHex(parseOklch(".48 .15 258"))).toBe("#1D5AB0");
    expect(oklchToHex(parseOklch(".17 .012 250"))).toBe("#0B1015");
    expect(oklchToHex(parseOklch("1 0 0"))).toBe("#FFFFFF");
  });
  it("색역 밖이면 C를 0.005씩 낮춘다(PAL-T5-1 accent C 0.125)", () => {
    const f = fitGamut({ l: 0.9, c: 0.17, h: 200 });
    expect(inGamut(f)).toBe(true);
    expect(f.c).toBe(0.125);
    expect(oklchToHex(f)).toBe("#63F7FF");
  });
  it("대비는 소수 둘째 자리 내림", () => {
    expect(contrast("#FFFFFF", "#000000")).toBe(21);
    expect(contrast("#1D5AB0", "#FCFCFC")).toBe(6.51); // 3.4.2 대비 표 6.5(표는 첫째 자리 표기)
  });
});
