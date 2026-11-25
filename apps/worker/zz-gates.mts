import { loadDesignData, fallbackMockup } from "@tastefit/design-spec";
import { compilePage } from "@tastefit/renderer";
import { evaluateGates } from "@tastefit/scoring";
import { openHarness } from "./dist/render/harness.js";
const d = loadDesignData("/home/claude/autodesignweb");
const h = await openHarness();
const t0 = Date.now(); const tally: Record<string, number> = {}; const ex: Record<string, string[]> = {};
const types = (process.argv[2] ?? "T1,T2,T3,T4,T5,T6,T7,T8").split(",");
const vws = (process.argv[3] ?? "1280,375").split(",").map(Number);
const gates = (process.argv[4] ?? "G-02,G-03,G-04,G-05,G-06,G-07").split(",");
for (const t of types) for (const p of ["saas", "local_business", "portfolio"]) for (const v of ["v_true", "v_fit", "v_bal"] as const) {
  const { spec, tree } = fallbackMockup(t, p, v, d);
  const { html } = compilePage(spec, tree, d);
  for (const vw of vws) {
    const m = await h.measure(html, vw, { spec });
    for (const g of evaluateGates(m, gates)) if (!g.pass) {
      tally[g.id] = (tally[g.id] ?? 0) + 1; (ex[g.id] ??= []).push(`${t}/${p}/${v}@${vw} ${g.violations.slice(0, 3).join(" | ")}`);
    }
  }
}
await h.close();
console.log("sec", (Date.now() - t0) / 1000, tally);
for (const [k, v] of Object.entries(ex)) console.log(k, v.length, "\n  " + v.slice(0, 12).join("\n  "));
