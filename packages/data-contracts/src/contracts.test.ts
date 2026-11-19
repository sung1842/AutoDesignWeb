import { describe, expect, it } from "vitest";
import { BUNDLES, envelope, typeDef } from "./index.js";

const meta = {
  bundle: "types",
  schemaVersion: 1,
  taxonomyVersion: "2026-S0",
  provenance: "temp",
  preparedAt: "2026-11-19T00:00:00Z",
  preparedBy: "seed:temp@abc1234",
};
const t1 = {
  id: "T1",
  slug: "calm-editorial",
  nameKo: "고요한 에디토리얼형",
  summaryKo: "[임시] 요약",
  descriptionKo: "가".repeat(200),
  strengthsKo: ["a", "b", "c"],
  centroid: [0.26, 0.81, 0.12, 0, 0],
  anchorPresetId: "PS-T1",
};

describe("data-contracts", () => {
  it("temp 봉투는 preparedBy가 seed:temp@<sha>여야 한다", () => {
    const s = envelope(typeDef);
    expect(s.safeParse({ ...meta, items: [t1] }).success).toBe(true);
    expect(s.safeParse({ ...meta, preparedBy: "HU", items: [t1] }).success).toBe(false);
    expect(
      s.safeParse({ ...meta, provenance: "human", preparedBy: "HU", items: [t1] }).success,
    ).toBe(true);
  });
  it("유형 이름에 MBTI 금지, centroid 범위 [0,1]", () => {
    expect(typeDef.safeParse({ ...t1, nameKo: "MBTI형" }).success).toBe(false);
    expect(typeDef.safeParse({ ...t1, centroid: [1.01, 0, 0, 0, 0] }).success).toBe(false);
  });
  it("레지스트리: B1~B25 각 1개 + 03장 나머지 8개, id 중복 없음", () => {
    const ids = BUNDLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let n = 1; n <= 25; n++) expect(ids).toContain(`B${n}`);
    expect(ids.filter((i) => i.startsWith("C03-"))).toHaveLength(8);
  });
});
