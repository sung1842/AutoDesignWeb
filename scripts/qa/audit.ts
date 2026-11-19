// qa:trace --audit 리터럴 감사(07장 7.12.2 "qa:trace --audit 정의", T-08, AC-07-18·22)
//   범위: tests/acceptance/**와 그 파일이 import하는 상대 경로 모듈 전체(import 그래프).
//   대상: 비교 매처 기대값(toBeGreaterThan[OrEqual]·toBeLessThan[OrEqual]·toBeCloseTo 첫 인자)과
//         비교 연산자 >=·<=·<·> 의 피연산자. 식별자는 const 선언(같은 파일·import)까지 따라가 리터럴로 푼다.
//   FAIL: 값 ∈ thresholds 잎 값 집합 \ auditAllowLiterals. 단 _support/spec-constants.ts의 SC_<NN>_ 상수 중
//         사양 상수 표(7.12.1) 행 SC-<NN>의 값 열 수치와 일치하는 것은 제외.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { COMPARE_OPS, lineOf, numericValue, parse, ts, walk } from "../guard/ast.js";
import { auditAllowLiterals, thresholdLeafNumbers } from "../guard/lib.js";

export const SPEC_CONSTANTS = "tests/acceptance/_support/spec-constants.ts";
const MATCHERS = new Set([
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toBeCloseTo",
]);

export interface AuditHit {
  use: string; // 파일:줄(비교 위치)
  decl: string; // 파일:줄(리터럴 위치)
  value: number;
}

interface Decl {
  value: number;
  at: string;
  name: string;
  file: string;
}

function listTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (/\.(ts|tsx|mts)$/.test(n) && !n.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  const cands = [base, base.replace(/\.(m?js)$/, ".ts"), `${base}.ts`, join(base, "index.ts")];
  return cands.find((c) => existsSync(c) && statSync(c).isFile() && /\.(ts|tsx|mts)$/.test(c)) ?? null;
}

/** 사양 상수 표(07장 7.12.1)의 행별 수치 집합. `%`가 붙은 수는 n과 n/100을 모두 넣는다. */
export function specConstantRows(specDir: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  const p = join(specDir, "07_quality.md");
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\| (SC-\d\d) \|[^|]*\|([^|]*)\|/.exec(line);
    if (!m || !m[1]) continue;
    const s = new Set<number>();
    for (const x of (m[2] ?? "").matchAll(/(\d+(?:\.\d+)?)(%?)/g)) {
      const n = Number(x[1]);
      s.add(n);
      if (x[2]) s.add(n / 100);
    }
    out.set(m[1], s);
  }
  return out;
}

export function audit(root: string, specDir = join(root, "docs/spec/FINAL")): AuditHit[] {
  const leaves = thresholdLeafNumbers(join(root, "config/thresholds.json"));
  const allow = auditAllowLiterals(join(root, "config/test-policy.json"));
  const sc = specConstantRows(specDir);
  const rel = (p: string): string => relative(root, p);
  const scExempt = (d: Decl): boolean => {
    if (rel(d.file) !== SPEC_CONSTANTS) return false;
    const m = /^SC_(\d\d)_/.exec(d.name);
    return !!m && (sc.get(`SC-${m[1]}`)?.has(d.value) ?? false);
  };

  // import 그래프 수집
  const queue = listTs(join(root, "tests/acceptance"));
  const files = new Map<string, ts.SourceFile>();
  while (queue.length) {
    const f = queue.pop() as string;
    if (files.has(f)) continue;
    const sf = parse(f, readFileSync(f, "utf8"));
    files.set(f, sf);
    for (const st of sf.statements) {
      if (
        (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) &&
        st.moduleSpecifier &&
        ts.isStringLiteral(st.moduleSpecifier)
      ) {
        const t = resolveImport(f, st.moduleSpecifier.text);
        if (t && !files.has(t)) queue.push(t);
      }
    }
  }

  // 파일별 숫자 const 선언과 import 바인딩
  const decls = new Map<string, Map<string, Decl>>();
  const imports = new Map<string, Map<string, { file: string; name: string }>>();
  for (const [f, sf] of files) {
    const d = new Map<string, Decl>();
    const im = new Map<string, { file: string; name: string }>();
    walk(sf, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        const list = n.parent;
        if (ts.isVariableDeclarationList(list) && list.flags & ts.NodeFlags.Const) {
          const v = numericValue(n.initializer);
          if (v !== null)
            d.set(n.name.text, {
              value: v,
              at: `${rel(f)}:${lineOf(sf, n.initializer.getStart(sf))}`,
              name: n.name.text,
              file: f,
            });
        }
      }
      if (
        ts.isImportDeclaration(n) &&
        ts.isStringLiteral(n.moduleSpecifier) &&
        n.importClause?.namedBindings &&
        ts.isNamedImports(n.importClause.namedBindings)
      ) {
        const t = resolveImport(f, n.moduleSpecifier.text);
        if (t)
          for (const el of n.importClause.namedBindings.elements)
            im.set(el.name.text, { file: t, name: (el.propertyName ?? el.name).text });
      }
    });
    decls.set(f, d);
    imports.set(f, im);
  }

  const lookup = (f: string, name: string, depth = 0): Decl | null => {
    if (depth > 8) return null;
    const own = decls.get(f)?.get(name);
    if (own) return own;
    const im = imports.get(f)?.get(name);
    return im ? lookup(im.file, im.name, depth + 1) : null;
  };

  const hits: AuditHit[] = [];
  for (const [f, sf] of files) {
    const check = (n: ts.Expression): void => {
      const e = ts.isParenthesizedExpression(n) ? n.expression : n;
      const v = numericValue(e);
      let d: Decl | null = null;
      if (v !== null) d = { value: v, at: `${rel(f)}:${lineOf(sf, e.getStart(sf))}`, name: "", file: f };
      else if (ts.isIdentifier(e)) d = lookup(f, e.text);
      if (!d || !leaves.has(d.value) || allow.has(d.value) || scExempt(d)) return;
      hits.push({ use: `${rel(f)}:${lineOf(sf, e.getStart(sf))}`, decl: d.at, value: d.value });
    };
    walk(sf, (n) => {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        MATCHERS.has(n.expression.name.text) &&
        n.arguments[0]
      )
        check(n.arguments[0]);
      if (ts.isBinaryExpression(n) && COMPARE_OPS.has(n.operatorToken.kind)) {
        check(n.left);
        check(n.right);
      }
    });
  }
  return hits.sort((a, b) => a.use.localeCompare(b.use));
}
