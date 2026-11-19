// guard 메타 테스트(09장 9.4.2 통과 조건 ⑥⑦ + 7.12.2 5~8단계). 각 위반을 임시 git 저장소에서 재현한다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUARD_FAIL, commit, edit, guard, run, tmpRepo } from "../acceptance/_support/sh.js";

const LOCK = "config/lock/locked-hashes.json";
const TUNED = "config/diagnosis-tuned.json";

interface LockFile {
  entries: Record<string, { sha256: string }>;
}
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** tuned 값을 바꾸고 locked-hashes의 tuned entry 해시를 맞춘다(sim-tune 커밋 재현). */
function retune(d: string, from: string, to: string): void {
  edit(d, TUNED, (s) => s.replace(from, to));
  const body = readFileSync(join(d, TUNED), "utf8");
  edit(d, LOCK, (s) => {
    const o = JSON.parse(s) as LockFile;
    const e = o.entries[TUNED];
    if (!e) throw new Error("tuned entry 없음");
    e.sha256 = sha(body);
    return JSON.stringify(o, null, 2) + "\n";
  });
}

describe("guard 메타 ⑥: 위반마다 종료 코드 1", () => {
  const cases: Array<[string, string, (d: string) => void | Promise<void>]> = [
    [
      "잠금 파일 1바이트 변경",
      "F01",
      (d) => edit(d, "tests/acceptance/_support/sh.ts", (s) => s + "\n"),
    ],
    [
      "it.skip 추가",
      "F02",
      (d) =>
        edit(
          d,
          "tests/unit/meta-skip.test.ts",
          () => 'import { it } from "vitest";\nit.skip("m", () => {});\n',
        ),
    ],
    [
      "@ts-ignore 추가",
      "F05",
      (d) =>
        edit(d, "packages/config/src/meta-ts.ts", () => "// @ts-ignore\nexport const m = 1;\n"),
    ],
    [
      "verify 스크립트 변경",
      "F08",
      (d) =>
        edit(d, "package.json", (s) => {
          const o = JSON.parse(s) as { scripts: Record<string, string> };
          o.scripts["verify:m1"] = "true";
          return JSON.stringify(o, null, 2) + "\n";
        }),
    ],
  ];
  for (const [name, fid, mutate] of cases) {
    it(`${name} → ${fid}`, async () => {
      const d = tmpRepo();
      await mutate(d);
      commit(d);
      const r = await guard(d);
      expect(r.code, r.out).toBe(GUARD_FAIL);
      expect(r.out).toContain(fid);
    });
  }

  it("테스트 1건 삭제 → F03", async () => {
    const d = tmpRepo();
    edit(
      d,
      "tests/unit/meta-count.test.ts",
      () =>
        'import { it, expect } from "vitest";\nit("m a", () => expect(true).toBe(true));\nit("m b", () => expect(true).toBe(true));\n',
    );
    commit(d, "test(unit): add");
    expect((await run("pnpm", ["-s", "guard:count", "--update"], d)).code).toBe(0);
    commit(d, "chore(guard): test-count baseline");
    edit(d, "tests/unit/meta-count.test.ts", (s) => s.replace(/it\("m b".*\n/, ""));
    commit(d);
    const r = await guard(d);
    expect(r.code, r.out).toBe(GUARD_FAIL);
    expect(r.out).toContain("F03");
  });
});

describe("guard 메타 ⑦: deps", () => {
  it("renderer에 lucide-react 추가 → F12", async () => {
    const d = tmpRepo();
    edit(d, "packages/renderer/package.json", (s) => {
      const o = JSON.parse(s) as { dependencies?: Record<string, string> };
      o.dependencies = { ...(o.dependencies ?? {}), "lucide-react": "^0.400.0" };
      return JSON.stringify(o, null, 2) + "\n";
    });
    commit(d);
    const r = await guard(d);
    expect(r.code, r.out).toBe(GUARD_FAIL);
    expect(r.out).toContain("F12");
  });
});

describe("guard 8단계: 진단 튜닝 자체 잠금", () => {
  it("값 집합 안 변경 + chore(sim-tune): 단독 커밋 → guard:tuned 통과", async () => {
    const d = tmpRepo();
    retune(d, '"calibKappa": 1.3', '"calibKappa": 1.4');
    commit(d, "chore(sim-tune): calibKappa 1.4");
    const r = await guard(d);
    expect(r.out).not.toContain("guard:tuned:");
    expect(r.code, r.out).not.toBe(GUARD_FAIL);
  });

  it("chore(sim-tune): 아닌 커밋으로 변경 → F20", async () => {
    const d = tmpRepo();
    retune(d, '"calibKappa": 1.3', '"calibKappa": 1.4');
    commit(d, "fix(diagnosis): tune");
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("F20");
  });

  it("값 집합 밖 값 → F20", async () => {
    const d = tmpRepo();
    retune(d, '"calibKappa": 1.3', '"calibKappa": 1.35');
    commit(d, "chore(sim-tune): 집합 밖");
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("calibKappa");
  });
});

describe("guard 7단계: qa:trace --audit", () => {
  it("수용 테스트 헬퍼의 thresholds 리터럴 비교 → guard:qa-audit FAIL", async () => {
    const d = tmpRepo();
    edit(
      d,
      "tests/acceptance/m1/meta-audit.test.ts",
      () =>
        'import { it, expect } from "vitest";\nconst h = Number("1");\nit("m", () => expect(h).toBeGreaterThanOrEqual(80));\n',
    );
    commit(d);
    const r = await guard(d);
    expect(r.code).toBe(GUARD_FAIL);
    expect(r.out).toContain("guard:qa-audit");
  });
});
