// guard:patterns — 금지 패턴(09장 9.5.5 F02·F05·F06·F11·F15·F16·F17, 07장 7.1.6, 7.12.2 3단계).
import { existsSync } from "node:fs";
import {
  COMPARE_OPS,
  accessPath,
  comments,
  numericValue,
  parse,
  ts,
  walk,
  lineOf,
} from "../ast.js";
import {
  CODE_RE,
  SKIP_DIRS,
  TEST_RE,
  auditAllowLiterals,
  readJson,
  readText,
  thresholdLeafNumbers,
  trackedFiles,
  type Finding,
} from "../lib.js";

/** 판정 코드(7.12.2 3단계: scoring, linter, pipeline, eval, sim). */
const JUDGE_RE = /^(packages\/(scoring|linter|pipeline)\/src\/|scripts\/eval-golden\.ts$|sim\/)/;
const NODE_ENV_RE = /^packages\/(scoring|linter|pipeline|llm)\/src\//;
const SKIP_CALLS =
  /^(it|test|describe|suite|bench)(\.(concurrent|sequential|each))?\.(skip|only|todo|fixme|skipIf|runIf)$|^(xit|xdescribe|xtest|fit|fdescribe)$|^test\.describe\.(skip|only|fixme)$/;
const GATE_OFF = /SKIP_GATE|--no-gate|QA_DISABLE/;
const PHASE23 = /figma|crawler|payment|darkPair|dark-pair/i;
const REMOTE = /supabase\s+db\s+push|\bvercel\s+(deploy|--prod)|\bfly\s+deploy/;
const RUNNER_CONFIGS = new Set(["vitest.config.ts", "playwright.config.ts"]);

interface Allow {
  paths?: Array<{ rule: string; glob: string }>;
}

function allowed(rule: string, file: string): boolean {
  const p = "config/forbidden-allowlist.json";
  if (!existsSync(p)) return false;
  const a = readJson<Allow>(p);
  return (a.paths ?? []).some(
    (x) =>
      x.rule === rule &&
      new RegExp(`^${x.glob.replace(/\*\*/g, ".*").replace(/(?<!\.)\*/g, "[^/]*")}$`).test(file),
  );
}

export function patternStage(): Finding[] {
  const out: Finding[] = [];
  const f = (fid: string, file: string, line: number, msg: string): void => {
    if (!allowed(fid, file))
      out.push({ stage: "guard:patterns", fid, status: "fail", message: `${file}:${line} ${msg}` });
  };
  const leaves = thresholdLeafNumbers();
  const allow = auditAllowLiterals();
  const policy = existsSync("config/test-policy.json")
    ? readJson<{ retries: { vitest: number; playwright: number } }>("config/test-policy.json")
    : null;

  // forbidden-allowlist는 경로만(T-08): 숫자 리터럴이 있으면 FAIL
  if (existsSync("config/forbidden-allowlist.json")) {
    const hasNum = (v: unknown): boolean =>
      typeof v === "number" ||
      (typeof v === "object" && v !== null && Object.values(v).some(hasNum));
    if (hasNum(readJson<unknown>("config/forbidden-allowlist.json"))) {
      f(
        "F04",
        "config/forbidden-allowlist.json",
        1,
        "forbidden-allowlist에 숫자 리터럴 항목(경로만 허용, T-08)",
      );
    }
  }

  for (const file of trackedFiles()) {
    if (SKIP_DIRS.test(file)) continue;
    if (PHASE23.test(file) && /^(apps|packages|data)\//.test(file))
      f("F15", file, 1, "Phase 2/3 금칙어가 경로에 있음");
    if (!CODE_RE.test(file)) {
      if (
        /^(apps\/web|packages\/ui|data\/taxonomy)\//.test(file) &&
        /\.(json|ya?ml|md|css|html)$/.test(file) &&
        /MBTI/.test(readText(file))
      ) {
        f("F16", file, 1, '"MBTI" 문자열');
      }
      continue;
    }
    const text = readText(file);
    const sf = parse(file, text);
    const isTest = TEST_RE.test(file);
    const guardSelf = file.startsWith("scripts/guard/") || file.startsWith("tests/guard/");

    for (const c of comments(sf)) {
      if (/@ts-(ignore|nocheck|expect-error)/.test(c.text))
        f("F05", file, c.line, "타입 검사 우회 주석");
      if (/eslint-disable/.test(c.text)) f("F05", file, c.line, "eslint-disable 주석");
    }
    if (/^(apps\/web|packages\/ui)\//.test(file) && /MBTI/.test(text))
      f("F16", file, 1, '"MBTI" 문자열');
    if (NODE_ENV_RE.test(file) && !isTest && /NODE_ENV/.test(text))
      f("F11", file, 1, "판정·llm 경로의 NODE_ENV 분기");
    if (JUDGE_RE.test(file) && GATE_OFF.test(text))
      f("F04", file, 1, "게이트를 끄는 문자열(SKIP_GATE 등, 7.1.6)");
    if (!guardSelf && /^(scripts|\.github)\//.test(file) && REMOTE.test(text))
      f("F17", file, 1, "원격 배포·마이그레이션 명령");

    walk(sf, (n) => {
      const line = (): number => lineOf(sf, n.getStart(sf));
      if (n.kind === ts.SyntaxKind.AnyKeyword) f("F05", file, line(), "any 타입");
      if (isTest && ts.isCallExpression(n)) {
        const p = accessPath(n.expression);
        if (p && SKIP_CALLS.test(p)) f("F02", file, line(), `테스트 비활성화(${p})`);
        // it(name, fn, timeout) 3번째 인자 = per-test 타임아웃(ASM-004: 루트 러너 설정 1곳만)
        if (p && /^(it|test)$/.test(p) && n.arguments.length >= 3)
          f("F06", file, line(), "테스트별 타임아웃 지정");
      }
      if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
        const key = n.name.text;
        if (isTest && /^(maxDiffPixelRatio|maxDiffPixels|threshold)$/.test(key))
          f("F04", file, line(), `시각 회귀 기준 재지정(${key}, 7.1.6)`);
        if (
          /^(retry|retries|testTimeout|hookTimeout)$/.test(key) &&
          (isTest || /config\.(ts|js|mjs)$/.test(file))
        ) {
          if (!RUNNER_CONFIGS.has(file)) f("F06", file, line(), `러너 설정 밖 ${key} 지정`);
          else if (key === "retry" || key === "retries") {
            const v = numericValue(n.initializer);
            const want = file.startsWith("vitest")
              ? policy?.retries.vitest
              : policy?.retries.playwright;
            if (v === null || v !== want)
              f("F06", file, line(), `${key}는 test-policy 값(${String(want)})만`);
          }
        }
      }
      if (
        JUDGE_RE.test(file) &&
        !isTest &&
        ts.isBinaryExpression(n) &&
        COMPARE_OPS.has(n.operatorToken.kind)
      ) {
        for (const side of [n.left, n.right]) {
          const v = numericValue(side);
          if (v !== null && leaves.has(v) && !allow.has(v))
            f(
              "F04",
              file,
              line(),
              `임계값 리터럴 비교(${v}) — getThresholds() 경유만(7.12.2 3단계)`,
            );
        }
      }
    });
  }
  return out;
}
