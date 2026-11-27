// M5 화면 수용 테스트 브리지: e2e/m5 Playwright 스펙 실행(01장 S04~S08) + S08 문구 정적 대조(AC-01-58 ④).
// 웹 서버·데이터는 playwright.config webServer(e2e/serve.ts, ASM-100). 계약: ASSUMPTIONS ASM-113·ASM-115.
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KO } from "../../../apps/web/src/copy/ko.js";
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
    { PLAYWRIGHT_JSON_OUTPUT_NAME: file },
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
/** 스펙 파일 안 test("…") 개수(이름이 바뀌어도 전부 실행됐는지 본다). */
const declared = (spec: string): number =>
  [...readFileSync(join(ROOT, spec), "utf8").matchAll(/^test\(/gm)].length;

/** 01장 원문(FINAL)에서 1.15.3 카피 표(키 → 문구)를 읽는다. */
function copyTable(): Map<string, string> {
  const dir = join(ROOT, "docs/spec/FINAL");
  const f = readdirSync(dir).find((x) => x.startsWith("01_"));
  const text = readFileSync(join(dir, String(f)), "utf8");
  const start = text.indexOf("### 1.15.3");
  const end = text.indexOf("\n### ", start + 1);
  const out = new Map<string, string>();
  for (const m of text.slice(start, end).matchAll(/^\| `([^`]+)` \| (.*) \|$/gm))
    if (m[1] && m[2] !== undefined) out.set(m[1], m[2].trim());
  return out;
}
function section(head: string): string {
  const dir = join(ROOT, "docs/spec/FINAL");
  const f = readdirSync(dir).find((x) => x.startsWith("01_"));
  const text = readFileSync(join(dir, String(f)), "utf8");
  const start = text.indexOf(head);
  return text.slice(start, text.indexOf("\n### ", start + 1));
}

describe("M5 화면 E2E(e2e/m5)", () => {
  it("AC-01-02 · AC-01-24 · AC-01-27 · AC-01-33 e2e/m5/flow.spec.ts: 로그인·동의 후 S06 복귀·자동 제출, 필수 무효 오류, 연락처 입력 0·고지, AI 배지", async () => {
    const spec = "e2e/m5/flow.spec.ts";
    const r = await playwright(spec);
    expect(r.results.size, r.out.slice(-3000)).toBe(declared(spec));
    expect(
      [...r.results].filter(([, ok]) => !ok),
      r.out.slice(-3000),
    ).toEqual([]);
  });
  it("AC-01-01 · AC-01-26 · AC-01-29 · AC-01-31 · AC-01-34 · AC-01-51 · AC-01-58 e2e/m5/screens.spec.ts 전부 통과", async () => {
    const spec = "e2e/m5/screens.spec.ts";
    const r = await playwright(spec);
    expect(r.results.size, r.out.slice(-3000)).toBe(declared(spec));
    expect(
      [...r.results].filter(([, ok]) => !ok),
      r.out.slice(-3000),
    ).toEqual([]);
  });
});

describe("S08 문구 정적 대조(AC-01-58 ④)", () => {
  it("AC-01-58 ④ 1.15.3 variant.*·drafts.* 키 문자열 = 서비스 카피(ko.ts), 1.7.1 변형 정의 문장 = 카피 표", () => {
    const table = copyTable();
    const keys = [...table.keys()].filter((k) => /^(variant|drafts)\./.test(k));
    expect(keys.length).toBeGreaterThan(0);
    const ko = KO as Record<string, string>;
    // 자리표시자 이름은 표(한국어)와 코드(영문)가 다르다 → {…}를 같은 표식으로 맞춰 비교(ASM-115)
    const ph = (x: string | undefined) => String(x).replace(/\{[^}]+\}/g, "{}");
    for (const k of keys) expect(ph(ko[k]), k).toBe(ph(table.get(k)));
    // 1.7.1: - `v_true` "라벨" — "정의"
    const s171 = section("### 1.7.1");
    const lines = [...s171.matchAll(/^\s+- `(v_[a-z]+)` "([^"]+)" — "([^"]+)"/gm)];
    expect(lines.map((m) => m[1])).toEqual(["v_true", "v_fit", "v_bal"]);
    for (const m of lines) {
      expect(table.get(`variant.${String(m[1])}.label`)).toBe(m[2]);
      expect(table.get(`variant.${String(m[1])}.desc`)).toBe(m[3]);
    }
    // 1.7.1 isFallback 배지 문구
    expect(s171).toContain(
      `\`drafts.fallbackBadge\`("${String(table.get("drafts.fallbackBadge"))}")`,
    );
  });
});
