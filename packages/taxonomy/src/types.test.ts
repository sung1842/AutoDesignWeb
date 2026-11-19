// 02장 2.12.1 nearestType(동률·경계)·2.4.2 브리지 규칙 1~3 단위. 데이터는 seed:temp 산출물.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { L1 } from "./map.js";
import { type Taxonomy, checkBridgeRules, loadTaxonomy, nearestType } from "./types.js";

const ROOT = join(import.meta.dirname, "../../..");
const tax = loadTaxonomy(ROOT);

describe("nearestType (02장 2.12.1)", () => {
  it("중심 입력은 자기 유형, 경계 아님", () => {
    for (const t of tax.types) {
      const v = nearestType(tax, t.centroid);
      expect(v.first).toBe(t.id);
      expect(v.isBoundary).toBe(false);
    }
  });
  it("두 중심의 중점은 동률·경계, 동률이면 types.json 순서", () => {
    const [a, b] = tax.types;
    if (!a || !b) throw new Error("유형 없음");
    const mid = a.centroid.map((x, k) => (x + (b.centroid[k] ?? 0)) / 2);
    const v = nearestType(tax, mid);
    expect(v.isTie).toBe(true);
    expect(v.isBoundary).toBe(true);
    expect([v.first, v.second]).toEqual([a.id, b.id]);
  });
});

describe("checkBridgeRules (02장 2.4.2)", () => {
  it("seed 데이터는 위반 0", () => {
    expect(checkBridgeRules(tax)).toEqual([]);
  });
  it("범위 밖·0.05 단위 아닌 브리지 값은 규칙 1 위반", () => {
    const bad: Taxonomy = {
      ...tax,
      standardVectors: tax.standardVectors.map((s) =>
        s.id === "SV09" ? { ...s, l1: [0.92, 0.41, 0.65, 0.85, 0.8] as L1 } : s,
      ),
    };
    const v = checkBridgeRules(bad);
    expect(v.some((m) => m.startsWith("규칙1 SV09") && m.includes("0.05"))).toBe(true);
    expect(v.some((m) => m.startsWith("규칙1 SV09") && m.includes("∉"))).toBe(true);
  });
  it("기준 유형이 L∞ 최근접이 아니면 규칙 2 위반", () => {
    const bad: Taxonomy = {
      ...tax,
      standardVectors: tax.standardVectors.map((s) =>
        s.id === "SV09" ? { ...s, baseTypeId: "T1" } : s,
      ),
    };
    expect(checkBridgeRules(bad).some((m) => m.startsWith("규칙2 SV09"))).toBe(true);
  });
});
