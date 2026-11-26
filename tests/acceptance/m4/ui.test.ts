// M4 화면 수용 테스트 브리지: e2e/m4의 Playwright 스펙을 실행해 전부 통과하는지 본다(01장 S01~S03, 09장 9.4.6 ⑧⑨⑩).
// 웹 서버·데이터는 playwright.config webServer(e2e/serve.ts, ASM-100). 스펙 파일 단위로 한 번씩 실행한다.
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, run } from "../_support/sh.js";

interface PwSuite {
  title: string;
  specs?: { title: string; ok: boolean }[];
  suites?: PwSuite[];
}
/** 스펙 파일 1개 실행 → {제목: 통과}. */
async function playwright(
  spec: string,
): Promise<{ code: number; out: string; results: Map<string, boolean> }> {
  const dir = mkdtempSync(join(tmpdir(), "tf-pw-"));
  const file = join(dir, "report.json");
  const r = await run(
    "pnpm",
    ["exec", "playwright", "test", spec, "--retries=0", "--reporter=json"],
    ROOT,
    {
      PLAYWRIGHT_JSON_OUTPUT_NAME: file,
    },
  );
  const results = new Map<string, boolean>();
  try {
    const rep = JSON.parse(readFileSync(file, "utf8")) as { suites: PwSuite[] };
    const walk = (s: PwSuite): void => {
      for (const x of s.specs ?? []) results.set(x.title, x.ok);
      for (const c of s.suites ?? []) walk(c);
    };
    rep.suites.forEach(walk);
  } catch {
    // 보고서가 없으면 아래 단언이 out을 보여 준다
  }
  return { ...r, results };
}

describe("M4 화면 E2E(e2e/m4)", () => {
  it("AC-00-03 · AC-01-17 · AC-01-18 · 9.4.6 ⑧⑨⑩ e2e/m4/survey.spec.ts: 375·1280 익명 완료, 재개·뒤로가기, MBTI 0", async () => {
    const r = await playwright("e2e/m4/survey.spec.ts");
    expect(r.results.size, r.out.slice(-3000)).toBe(4);
    expect(
      [...r.results].filter(([, ok]) => !ok),
      r.out.slice(-3000),
    ).toEqual([]);
  });
  it("AC-01-04 · AC-01-05 · AC-01-06 · AC-01-07 · AC-01-08 · AC-01-10 · AC-01-11 · AC-01-12 · AC-01-55 e2e/m4/quiz.spec.ts 전부 통과", async () => {
    const r = await playwright("e2e/m4/quiz.spec.ts");
    expect(r.results.size, r.out.slice(-3000)).toBe(11);
    expect(
      [...r.results].filter(([, ok]) => !ok),
      r.out.slice(-3000),
    ).toEqual([]);
  });
  it("AC-00-02 · AC-01-15 · AC-01-16 · AC-01-19 · AC-01-57 · AC-05-10 e2e/m4/result.spec.ts 전부 통과", async () => {
    const r = await playwright("e2e/m4/result.spec.ts");
    expect(r.results.size, r.out.slice(-3000)).toBe(5);
    expect(
      [...r.results].filter(([, ok]) => !ok),
      r.out.slice(-3000),
    ).toEqual([]);
  });
});
