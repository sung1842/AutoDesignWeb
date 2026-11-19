// M0 수용 테스트: qa:trace(07장 7.1.7·7.12.2 --audit, AC-07-07·18·22·23, AC-00-01·07).
import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GUARD_FAIL, ROOT, commit, edit, qaTrace, tmpRepo } from "../_support/sh.js";

interface TraceJson {
  results: Record<string, { milestone: string; status: "pass" | "fail"; reason?: string }>;
  unassigned: string[];
  duplicated: string[];
}
async function traceJson(d: string): Promise<TraceJson> {
  const r = await qaTrace(d, ["--json"]);
  return JSON.parse(r.out) as TraceJson;
}

const ACC_TEST = (id: string) =>
  `import { it, expect } from "vitest";\nit("${id}: fixture", () => expect(true).toBe(true));\n`;

describe("M0 qa:trace", () => {
  it("AC-00-01 / AC-00-07: 문서 검사(qa:trace --docs) 통과", async () => {
    const r = await qaTrace(ROOT, ["--docs"]);
    expect(r.code, r.out).toBe(0);
  });

  it("AC-07-23 ①: 모든 AC ID가 정확히 1개 마일스톤에 배정된다", async () => {
    const j = await traceJson(ROOT);
    expect(j.unassigned).toEqual([]);
    expect(j.duplicated).toEqual([]);
    for (const v of Object.values(j.results)) expect(v.milestone).toMatch(/^M[0-8]$/);
    expect(Object.keys(j.results).length).toBeGreaterThan(0);
  });

  it("AC-07-23 ③: 범위 항목은 접미사 ID를 포함하고 단일 항목은 포함하지 않는다", async () => {
    const j = await traceJson(ROOT);
    expect(j.results["AC-06-03b"]?.milestone).toBe("M1");
    expect(j.results["AC-06-07"]?.milestone).toBe("M1");
    expect(j.results["AC-06-07b"]?.milestone).toBe("M5");
  });

  it("AC-07-07: 매핑을 지운 AC ID 1개가 FAIL로 출력된다", async () => {
    const d = tmpRepo();
    expect((await traceJson(d)).results["AC-09-14"]?.status).toBe("pass");
    edit(d, "qa/traceability.yaml", (s) =>
      s
        .split("\n")
        .filter((l) => !l.startsWith("AC-09-14:"))
        .join("\n"),
    );
    commit(d);
    const r = await qaTrace(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("AC-09-14");
    expect((await traceJson(d)).results["AC-09-14"]?.status).toBe("fail");
  });

  it("AC-07-23 ②: M5 배정 AC는 tests/acceptance/m5/ 매핑만 PASS", async () => {
    const id = "AC-06-09";
    const cases: Array<[string, "pass" | "fail"]> = [
      ["tests/unit/acc-trace.test.ts", "fail"],
      ["tests/acceptance/m4/acc-trace.test.ts", "fail"],
      ["tests/acceptance/m5/acc-trace.test.ts", "pass"],
    ];
    for (const [file, want] of cases) {
      const d = tmpRepo();
      edit(d, file, () => ACC_TEST(id));
      edit(d, "qa/traceability.yaml", (s) => `${s.trimEnd()}\n${id}: [${file}#"${id}: fixture"]\n`);
      commit(d);
      expect((await traceJson(d)).results[id]?.status, file).toBe(want);
    }
  });

  describe("AC-07-18 / AC-07-22: --audit 리터럴 감사", () => {
    const auditWith = async (files: Record<string, string>) => {
      const d = tmpRepo();
      for (const [f, body] of Object.entries(files)) edit(d, f, () => body);
      commit(d);
      return qaTrace(d, ["--audit"]);
    };

    it("AC-07-18 / AC-07-22: 허용 목록 밖 리터럴 비교는 FAIL하고 파일·줄을 출력", async () => {
      const body =
        'import { it, expect } from "vitest";\nconst h = Number("1");\nit("x", () => expect(h).toBeGreaterThanOrEqual(80));\n';
      const r = await auditWith({ "tests/acceptance/m0/zz-audit.test.ts": body });
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("tests/acceptance/m0/zz-audit.test.ts:3");
    });

    it("AC-07-22: 헬퍼 상수 const H = 80 경유도 FAIL하고 파일·줄을 출력", async () => {
      const helper = "export const H = 80;\n";
      const body =
        'import { it, expect } from "vitest";\nimport { H } from "./zz-h.js";\nconst h = Number("1");\nit("x", () => expect(h).toBeGreaterThanOrEqual(H));\n';
      const r = await auditWith({
        "tests/acceptance/m0/zz-h.ts": helper,
        "tests/acceptance/m0/zz-audit2.test.ts": body,
      });
      expect(r.code).toBe(GUARD_FAIL);
      expect(r.out).toContain("zz-h.ts:1");
      expect(r.out).toContain("zz-audit2.test.ts:4");
    });

    it("AC-07-22: toBe(404)·toHaveLength(72)는 감사 대상 아님", async () => {
      const body =
        'import { it, expect } from "vitest";\nconst s = Number("404");\nit("x", () => { expect(s).toBe(404); expect(new Array(72)).toHaveLength(72); });\n';
      const r = await auditWith({ "tests/acceptance/m0/zz-ok.test.ts": body });
      expect(r.out).not.toContain("zz-ok.test.ts");
    });
  });

  it("AC-07-22: 사양 상수 표 밖 수치를 비교 기준으로 쓰는 AC 문장 → 키 커버리지 FAIL", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-spec-"));
    cpSync(join(ROOT, "docs/spec/FINAL"), dir, { recursive: true });
    const f = join(dir, "09_implementation.md");
    writeFileSync(f, readFileSync(f, "utf8") + "\n| AC-09-99 | 응답 시간이 777ms 이하이다. |\n");
    const r = await qaTrace(ROOT, ["--key-coverage", "--spec-dir", dir]);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("09_implementation.md");
    expect(r.out).toContain("777");
  });
});
