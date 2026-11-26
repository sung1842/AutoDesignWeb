// AIL-16 기본값 잔존(04장 4.13.2, D): shadcn/Tailwind 기본값(packages/linter/data/defaults.json).
import { readFileSync } from "node:fs";
import { finding, parseShadows, pkgFile } from "../src/lib.js";
import type { LintFinding, Rule } from "../src/types.js";

interface Defaults {
  rootVars: Record<string, string[]>;
  colorPairs: [string, string][];
  colors: string[];
  shadows: number[][][];
}
let D: Defaults | null = null;
const defaults = (): Defaults =>
  (D ??= JSON.parse(readFileSync(pkgFile("data/defaults.json"), "utf8")) as Defaults);
const sp = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();
const EPS = 1e-3;

export const rule: Rule = {
  id: "AIL-16",
  stage: ["D"],
  severity: ["error"],
  appliesTo: ["M", "U"],
  messageKo: "UI 라이브러리 기본값이 그대로 남아 있습니다.",
  fixHint: "radius·색·그림자를 서비스 토큰 값으로 덮어쓰세요.",
  check(ctx) {
    const s = ctx.snapshot;
    if (!s) return [];
    const d = defaults();
    const out: LintFinding[] = [];
    for (const [k, vals] of Object.entries(d.rootVars)) {
      const v = s.rootVars[k];
      if (v !== undefined && vals.includes(sp(v)))
        out.push(finding("AIL-16", "error", `${k}: ${v}`));
    }
    const used = new Set<string>();
    for (const e of s.elements) for (const c of [e.color, e.bgColor, e.borderColor]) used.add(sp(c));
    for (const v of Object.values(s.rootVars)) used.add(sp(v));
    for (const [a, b] of d.colorPairs)
      if (used.has(a) && used.has(b)) out.push(finding("AIL-16", "error", `기본 색 쌍 ${a}·${b}`));
    for (const c of d.colors)
      if (used.has(c)) out.push(finding("AIL-16", "error", `기본 팔레트 색 ${c}`));
    for (const e of s.elements) {
      const sh = parseShadows(e.boxShadow);
      for (const ref of d.shadows)
        if (
          sh.length === ref.length &&
          ref.every((r, i) => {
            const x = sh[i];
            return (
              !!x &&
              x.x === r[0] &&
              x.y === r[1] &&
              x.blur === r[2] &&
              x.spread === r[3] &&
              Math.abs((x.color?.alpha ?? 1) - (r[4] ?? 0)) < EPS &&
              (x.color?.l ?? 1) < EPS
            );
          })
        ) {
          out.push(finding("AIL-16", "error", `${e.tag} Tailwind 기본 그림자`));
          break;
        }
    }
    return out;
  },
};
