// guard:verify-scripts — package.json verify:* = .guard/verify-scripts.json(09장 9.5.5 F08).
import { existsSync } from "node:fs";
import { readJson, type Finding } from "../lib.js";

export const VERIFY_COPY = ".guard/verify-scripts.json";

export function verifyScriptsOf(): Record<string, string> {
  const pj = readJson<{ scripts?: Record<string, string> }>("package.json");
  return Object.fromEntries(
    Object.entries(pj.scripts ?? {}).filter(([k]) => k.startsWith("verify:")),
  );
}

export function verifyScriptsStage(): Finding[] {
  const cur = verifyScriptsOf();
  const f = (m: string): Finding => ({
    stage: "guard:verify-scripts",
    fid: "F08",
    status: "fail",
    message: m,
  });
  if (!existsSync(VERIFY_COPY))
    return Object.keys(cur).length ? [f(`${VERIFY_COPY} 없음(verify:* 스크립트가 있음)`)] : [];
  const want = readJson<Record<string, string>>(VERIFY_COPY);
  const keys = new Set([...Object.keys(cur), ...Object.keys(want)]);
  return [...keys]
    .filter((k) => cur[k] !== want[k])
    .map((k) => f(`package.json ${k} ≠ ${VERIFY_COPY}`));
}
