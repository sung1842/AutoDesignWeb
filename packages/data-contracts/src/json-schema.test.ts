// 최소 JSON Schema 검증기(ASM-030) 동작 확인.
import { describe, expect, it } from "vitest";
import { MiniValidator } from "./json-schema.js";
import { validateTokenSet } from "./m2.js";

describe("MiniValidator", () => {
  const root = {
    $defs: { hex: { type: "string", pattern: "^#[0-9A-F]{6}$" } },
    type: "object",
    required: ["a"],
    additionalProperties: false,
    properties: {
      a: { $ref: "#/$defs/hex" },
      b: { type: "array", prefixItems: [{ type: "number", minimum: 0, maximum: 1 }], minItems: 1 },
      c: { oneOf: [{ const: 1 }, { const: 2 }] },
      d: { not: { required: ["x"] } },
    },
  };
  const v = new MiniValidator(root);
  it("통과", () => expect(v.validate(root, { a: "#ABCDEF", b: [0.5], c: 2, d: {} })).toEqual([]));
  it("위반", () => {
    expect(v.validate(root, {}).length).toBeGreaterThan(0);
    expect(v.validate(root, { a: "#abcdef" }).length).toBeGreaterThan(0);
    expect(v.validate(root, { a: "#ABCDEF", z: 1 }).length).toBeGreaterThan(0);
    expect(v.validate(root, { a: "#ABCDEF", b: [2] }).length).toBeGreaterThan(0);
    expect(v.validate(root, { a: "#ABCDEF", c: 3 }).length).toBeGreaterThan(0);
    expect(v.validate(root, { a: "#ABCDEF", d: { x: 1 } }).length).toBeGreaterThan(0);
  });
  it("validateTokenSet: 빈 객체는 실패", () => expect(validateTokenSet({}).ok).toBe(false));
});
