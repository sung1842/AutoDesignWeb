// 04장 AC-04-19: 하드 게이트 G-01~G-13·조화 H1~H12를 항목별 독립 순수 함수로 노출한다(ASM-078 ①·ASM-084).
// 측정 게이트(G-02~G-07·G-12)는 evaluateGates(하네스 측정값)와 같은 판정을 쓴다.
import { judgeAbuse } from "@tastefit/compliance";
import { thresholdNumber } from "@tastefit/config";
import { treeLint } from "@tastefit/linter";
import { evaluateGates, type GateResult } from "./gates.js";
import { harmonyScore, type HarmonyOptions } from "./harmony.js";
import type { OriginalityReport } from "./originality.js";

type Obj = { [k: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const strs = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
const result = (id: string, violations: string[]): GateResult => ({
  id,
  pass: violations.length === 0,
  violations,
});

/** 측정 게이트 입력: 측정값 1개 또는 {measures: [...]}(뷰포트별). 위반에 뷰포트를 붙인다. */
function measured(id: string): (input: unknown) => GateResult {
  return (input) => {
    const ms = isObj(input) && Array.isArray(input.measures) ? input.measures : [input];
    const v: string[] = [];
    for (const m of ms) {
      const vw = isObj(m) && typeof m.vw === "number" ? `${m.vw}: ` : "";
      for (const g of evaluateGates(m, [id])) v.push(...g.violations.map((x) => `${vw}${x}`));
    }
    return result(id, v);
  };
}

/** G-01 LT 규칙(4.10.2: LT-01~04·09·10) + PageSchema(treeLint의 G-01). */
const G01_RULES = new Set(["G-01", "LT-01", "LT-02", "LT-03", "LT-04", "LT-09", "LT-10"]);
/** G-08 차단 영향도(R-28). */
const AXE_BLOCKING = new Set(["serious", "critical"]);

export const GATE_FNS: Readonly<Record<string, (input: unknown) => GateResult>> = {
  "G-01": (input) => {
    const i = isObj(input) ? input : {};
    return result(
      "G-01",
      treeLint(i.spec, i.tree)
        .filter((f) => G01_RULES.has(f.rule) && f.severity === "error")
        .map((f) => `${f.rule} ${f.message}`),
    );
  },
  "G-02": measured("G-02"),
  "G-03": measured("G-03"),
  "G-04": measured("G-04"),
  "G-05": measured("G-05"),
  "G-06": measured("G-06"),
  "G-07": measured("G-07"),
  // 입력 = axe 결과 {axe: [{vw, violations: [{id, impact}]}]}(1280·375)
  "G-08": (input) => {
    const runs = isObj(input) && Array.isArray(input.axe) ? input.axe.filter(isObj) : [];
    const v: string[] = [];
    if (runs.length === 0) v.push("axe 결과 없음");
    for (const r of runs)
      for (const x of Array.isArray(r.violations) ? r.violations.filter(isObj) : [])
        if (AXE_BLOCKING.has(String(x.impact)))
          v.push(`${String(r.vw ?? "")} ${String(x.id)} ${String(x.impact)}`);
    return result("G-08", v);
  },
  // 입력 = {lint: LintFinding[]}(단계 S·C·T·D·P 합산)
  "G-09": (input) => {
    const lint = isObj(input) && Array.isArray(input.lint) ? input.lint.filter(isObj) : [];
    const errs = lint.filter((f) => f.severity === "error");
    return result(
      "G-09",
      errs.length > thresholdNumber("generation.lint.errorMax")
        ? errs.map((f) => `${String(f.rule)} ${String(f.message ?? "")}`)
        : [],
    );
  },
  // 입력 = {brandName, nav: string[], hero: string[], footer: string[]}
  "G-10": (input) => {
    const i = isObj(input) ? input : {};
    const name = typeof i.brandName === "string" ? i.brandName.normalize("NFC") : "";
    const v: string[] = [];
    if (!name) v.push("브랜드명 없음");
    for (const where of ["nav", "hero", "footer"])
      if (!strs(i[where]).some((t) => name !== "" && t.normalize("NFC").includes(name)))
        v.push(`${where}에 브랜드명 없음`);
    return result("G-10", v);
  },
  // 입력 = {originality: OriginalityReport}(08장 8.3.3)
  "G-11": (input) => {
    const o =
      isObj(input) && isObj(input.originality)
        ? (input.originality as unknown as OriginalityReport)
        : null;
    if (!o) return result("G-11", ["OriginalityReport 없음"]);
    return result(
      "G-11",
      o.passed === true ? [] : (o.violated ?? []).map((g) => `GATE_FAILED:G-11 ${g}`),
    );
  },
  "G-12": measured("G-12"),
  // 입력 = {texts: string[]}(최종 트리의 모든 텍스트)
  "G-13": (input) => {
    const texts = isObj(input) ? strs(input.texts) : [];
    return result(
      "G-13",
      judgeAbuse(texts).map((x) => `${x.reason} ${x.term}`),
    );
  },
};

export interface HarmonyItemResult {
  id: string;
  score: number;
  max: number;
  measured: unknown;
}
/** 입력 = {spec, tree, render?, violations?, conflicts?} → harmonyScore의 해당 항목. */
function harmonyItem(id: string): (input: unknown) => HarmonyItemResult {
  return (input) => {
    const i = isObj(input) ? input : {};
    const opts: HarmonyOptions = {};
    if (isObj(i.render)) opts.render = i.render as HarmonyOptions["render"];
    if (Array.isArray(i.violations)) opts.violations = i.violations as { rule: string }[];
    if (Array.isArray(i.conflicts)) opts.conflicts = strs(i.conflicts);
    const it = harmonyScore(i.spec ?? {}, i.tree ?? {}, opts).items.find((x) => x.id === id);
    if (!it) throw new Error(`조화 항목 없음 ${id}`);
    return { id, score: it.points, max: it.max, measured: it.measured };
  };
}
export const HARMONY_FNS: Readonly<Record<string, (input: unknown) => HarmonyItemResult>> =
  Object.fromEntries(
    Array.from({ length: 12 }, (_, k) => `H${k + 1}`).map((id) => [id, harmonyItem(id)]),
  );
