// 04장 4.13 AI 티 린터 진입점(ASM-077): 규칙 24개(rules/AIL-xx.ts 1파일 1규칙)와 lintAll.
import { rule as R01 } from "../rules/AIL-01.js";
import { rule as R02 } from "../rules/AIL-02.js";
import { rule as R03 } from "../rules/AIL-03.js";
import { rule as R04 } from "../rules/AIL-04.js";
import { rule as R05 } from "../rules/AIL-05.js";
import { rule as R06 } from "../rules/AIL-06.js";
import { rule as R07 } from "../rules/AIL-07.js";
import { rule as R08 } from "../rules/AIL-08.js";
import { rule as R09 } from "../rules/AIL-09.js";
import { rule as R10 } from "../rules/AIL-10.js";
import { rule as R11 } from "../rules/AIL-11.js";
import { rule as R12 } from "../rules/AIL-12.js";
import { rule as R13 } from "../rules/AIL-13.js";
import { rule as R14 } from "../rules/AIL-14.js";
import { rule as R15 } from "../rules/AIL-15.js";
import { rule as R16 } from "../rules/AIL-16.js";
import { rule as R17 } from "../rules/AIL-17.js";
import { rule as R18 } from "../rules/AIL-18.js";
import { rule as R19 } from "../rules/AIL-19.js";
import { rule as R20 } from "../rules/AIL-20.js";
import { rule as R21 } from "../rules/AIL-21.js";
import { rule as R22 } from "../rules/AIL-22.js";
import { rule as R23 } from "../rules/AIL-23.js";
import { rule as R24 } from "../rules/AIL-24.js";
import { isObj } from "./lib.js";
import type { CopyItem, LintFinding, LintInput, Rule, RuleCtx, Snapshot, Stage } from "./types.js";

/** 4.13.2 규칙 전체 v1(표 순서). */
export const RULES: readonly Rule[] = [R01, R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24];

function copyOf(c: LintInput["copy"]): CopyItem[] | null {
  if (Array.isArray(c)) return c;
  if (isObj(c) && Array.isArray(c.items)) return c.items as CopyItem[];
  return null;
}

/** 입력에 있는 단계만 실행한다: spec → S, copy → C, tree → T, snapshot → D·P(4.13.1). */
export function stagesOf(input: LintInput): Stage[] {
  const st: Stage[] = [];
  if (isObj(input.spec)) st.push("S");
  if (copyOf(input.copy)) st.push("C");
  if (isObj(input.tree)) st.push("T");
  if (input.snapshot) st.push("D", "P");
  return st;
}

/** 규칙 24개를 입력 단계에 대해 실행한다. 결과 순서 = 규칙 순서. */
export function lintAll(input: LintInput, opts: { stages?: Stage[] } = {}): LintFinding[] {
  const want = new Set(opts.stages ?? stagesOf(input));
  const full: RuleCtx = {
    spec: isObj(input.spec) ? input.spec : null,
    tree: isObj(input.tree) ? input.tree : null,
    copy: copyOf(input.copy),
    brand: isObj(input.brand) ? input.brand : null,
    snapshot: (input.snapshot as Snapshot | undefined) ?? null,
    stages: want,
  };
  const out: LintFinding[] = [];
  for (const r of RULES) {
    if (!r.stage.some((s) => want.has(s))) continue;
    // 규칙이 보는 입력은 그 규칙 단계의 입력뿐이다. spec은 문맥(톤·프리셋)으로 늘 준다
    const has = (s: Stage): boolean => r.stage.includes(s) && want.has(s);
    const ctx: RuleCtx = {
      spec: full.spec,
      tree: has("T") ? full.tree : null,
      copy: has("C") ? full.copy : null,
      brand: full.brand,
      snapshot: has("D") || has("P") ? full.snapshot : null,
      stages: new Set(r.stage.filter((x) => want.has(x))),
    };
    out.push(...r.check(ctx));
  }
  return out;
}
