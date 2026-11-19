// guard:qa-audit — 07장 7.12.2 7단계(09장 9.4.2 산출물): qa:trace --audit(AC 배정 중복·리터럴 감사·키 커버리지).
import { audit } from "../../qa/audit.js";
import { keyCoverage } from "../../qa/key-coverage.js";
import { trace } from "../../qa/trace.js";
import type { Finding } from "../lib.js";

export function qaAuditStage(root = process.cwd()): Finding[] {
  const out: Finding[] = [];
  const specDir = `${root}/docs/spec/FINAL`;
  const fail = (fid: string, message: string): void =>
    void out.push({ stage: "guard:qa-audit", fid, status: "fail", message });
  for (const id of trace(root, specDir).duplicated) fail("F03", `${id}: AC 중복 배정`);
  for (const h of audit(root, specDir))
    fail("F04", `audit ${h.use}: thresholds 잎 값 리터럴 ${h.value} (리터럴 위치 ${h.decl})`);
  for (const h of keyCoverage(root, specDir)) {
    const message = `key-coverage ${h.file}:${h.line}: "${h.text}" thresholds 키·사양 상수 표 밖`;
    if (h.blockedBy)
      out.push({
        stage: "guard:qa-audit",
        fid: "F04",
        status: "blocked",
        blockedBy: h.blockedBy,
        message,
      });
    else fail("F04", message);
  }
  return out;
}
