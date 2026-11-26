// M4 수용 테스트(6/7): eval:golden:build-answers 결정성·채움·M1a 변이(07장 7.2.2·7.2.4, AC-07-20,
// 09장 9.4.6 ⑪·AC-09-17 앞부분). 계약은 ASSUMPTIONS ASM-097. 잠금(m4-done 뒤 1바이트 변경 FAIL)은 guard 메타 테스트 몫.
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getThresholds } from "../../../packages/config/src/index.js";
import { replayGolden, type GoldenCase } from "../../../packages/diagnosis/src/index.js";
import { ROOT, run } from "../_support/sh.js";

const MU_ABS = (getThresholds().release as unknown as { golden: { m1: { muRefAbsMax: number } } })
  .golden.m1.muRefAbsMax;
const KEYS = ["expression", "temperature", "shape", "density", "depth"] as const;
const dirOf = (d: string): Map<string, string> =>
  new Map(
    readdirSync(d)
      .filter((f) => /^GS-\d\d\.json$/.test(f))
      .sort()
      .map((f) => [f, readFileSync(join(d, f), "utf8")]),
  );

describe("9.4.6 ⑪ · AC-07-20 · AC-09-17 build-answers", () => {
  const outs = [
    mkdtempSync(join(tmpdir(), "tf-golden-a-")),
    mkdtempSync(join(tmpdir(), "tf-golden-b-")),
  ];
  it("2회 실행 출력 바이트 동일, 32행 모두 answers·muRef(소수 6자리) 채움, 재생 유형 = expected.typeId", async () => {
    for (const o of outs) {
      const r = await run("pnpm", ["-s", "eval:golden:build-answers", "--out", o], ROOT);
      expect(r.code, r.out.slice(-2000)).toBe(0);
    }
    const [a, b] = outs.map(dirOf);
    expect(a!.size).toBe(32);
    expect([...a!.entries()]).toEqual([...b!.entries()]);
    for (const [f, txt] of a!) {
      const c = JSON.parse(txt) as GoldenCase;
      expect(Array.isArray(c.answers) && c.answers.length > 0, f).toBe(true);
      for (const k of KEYS)
        expect(String(c.expected.muRef?.[k]), `${f} ${k}`).toMatch(/^\d(\.\d{1,6})?$/);
      expect(replayGolden(c).typeId, f).toBe(c.expected.typeId);
    }
  });
  it("AC-07-20 β 8 → 8.5로 재생하면 M1a(유형 24/24·muRef 120축 ±muRefAbsMax)가 깨진다", () => {
    const cases = [...dirOf(outs[0]!).values()]
      .map((t) => JSON.parse(t) as GoldenCase)
      .filter((c) => c.kind === "core");
    expect(cases).toHaveLength(24);
    const m1a = (beta?: number): boolean =>
      cases.every((c) => {
        const r = replayGolden(c, beta === undefined ? {} : { beta });
        return (
          r.typeId === c.expected.typeId &&
          KEYS.every(
            (k, i) => Math.abs((r.mu[i] ?? NaN) - (c.expected.muRef?.[k] ?? NaN)) <= MU_ABS,
          )
        );
      });
    expect(m1a()).toBe(true);
    expect(m1a(8.5)).toBe(false);
  });
});
