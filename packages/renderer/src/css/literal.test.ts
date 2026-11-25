import { describe, expect, it } from "vitest";
import { cssLiteralViolations, declarations } from "./literal.js";
import { rendererCssSources } from "./sources.js";

describe("CM-02 리터럴 검사", () => {
  it("색·치수·!important를 잡는다", () => {
    expect(cssLiteralViolations(".a{color:red}")).toEqual(["color: 이름 색 red"]);
    expect(cssLiteralViolations(".a{width:50%}")).toEqual(["width: 치수 리터럴 50%"]);
    expect(cssLiteralViolations(".a{transition-duration:120ms}")).toHaveLength(1);
    expect(cssLiteralViolations(".a{color:var(--tf-x, #000)}")).toHaveLength(1);
    expect(cssLiteralViolations(".a{color:var(--tf-color-fg) !important}")).toEqual([
      "color: !important",
    ]);
    expect(cssLiteralViolations(".a{background:color-mix(in oklab, var(--a), var(--b))}")).toHaveLength(1);
  });
  it("@media 머리·선택자·0 단위·단위 없는 수는 통과", () => {
    expect(
      cssLiteralViolations(
        "@media (min-width: 48rem) { .a:nth-child(2):hover { margin: 0px; opacity: 0.06; flex: 1; } }",
      ),
    ).toEqual([]);
  });
  it("선언만 뽑는다", () => {
    expect(declarations("a:hover{color:inherit;margin:0}").map((d) => d.prop)).toEqual([
      "color",
      "margin",
    ]);
  });
  it("레지스트리 CSS 전부 위반 0", () => {
    for (const s of rendererCssSources()) expect(cssLiteralViolations(s.css), s.path).toEqual([]);
  });
});
