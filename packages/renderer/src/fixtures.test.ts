import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadDesignData } from "@tastefit/design-spec";
import { LayoutTreeRawSchema, PageSchema } from "@tastefit/layout-schema";
import { compilePage, fixturePage } from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const DIR = join(ROOT, "fixtures/layouts");
const data = loadDesignData(ROOT);
const fx = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map(
    (f) =>
      ({ file: f, ...JSON.parse(readFileSync(join(DIR, f), "utf8")) }) as {
        file: string;
        purpose: string;
        raw: { pattern_id: string };
      },
  );

describe("fixtures/layouts(9.4.4 ①, M2-08b, ASM-054)", () => {
  it("용도별 10개 이상, 용도별 패턴 1~4가 모두 있다", () => {
    for (const [p, pre] of [
      ["saas", "PS"],
      ["local_business", "PL"],
      ["portfolio", "PP"],
    ] as const) {
      const mine = fx.filter((f) => f.purpose === p);
      expect(mine.length, p).toBeGreaterThanOrEqual(10);
      const ids = new Set(mine.map((f) => f.raw.pattern_id));
      for (const k of [1, 2, 3, 4]) expect(ids.has(`${pre}-${k}`), `${pre}-${k}`).toBe(true);
    }
  });
  it("전부 원시 스키마 유효 → fixturePage 확정 트리 PageSchema 유효 → 컴파일", () => {
    const bad: string[] = [];
    for (const f of fx) {
      const r = LayoutTreeRawSchema.safeParse(f.raw);
      if (!r.success) {
        bad.push(`${f.file} raw ${JSON.stringify(r.error.issues[0])}`);
        continue;
      }
      const { spec, tree } = fixturePage(f, data);
      const pr = PageSchema.safeParse(tree);
      if (!pr.success) bad.push(`${f.file} page ${JSON.stringify(pr.error.issues[0])}`);
      expect(compilePage(spec, tree, data).html.length, f.file).toBeGreaterThan(1000);
    }
    expect(bad).toEqual([]);
  });
});
