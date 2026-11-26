// 09장 9.4.1 S-02 렌더 환경 지문: RENDER_ENV_ID = sha256(Chromium 리비전 + 폰트 파일 목록·해시 + OS id) 앞 12자.
// 기준선 위치 e2e/__screenshots__/<RENDER_ENV_ID>/. 해석은 ASSUMPTIONS ASM-071.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

/** 실행 파일 경로의 `chromium[_headless_shell]-<리비전>` 숫자. 못 찾으면 경로 전체. */
export function chromiumRevision(): string {
  const p = chromium.executablePath();
  return /chromium(?:_headless_shell)?-(\d+)/.exec(p)?.[1] ?? p;
}

/** fontconfig가 아는 폰트 파일(정렬)과 각 내용 해시. fc-list가 없으면 빈 목록. */
export function fontFingerprint(): string[] {
  let out = "";
  try {
    out = execFileSync("fc-list", ["--format", "%{file}\n"], { encoding: "utf8" });
  } catch {
    return [];
  }
  const files = [...new Set(out.split("\n").filter(Boolean))].sort();
  return files.map((f) => `${f}:${existsSync(f) ? sha(readFileSync(f)) : "missing"}`);
}

export function osId(): string {
  if (!existsSync("/etc/os-release")) return process.platform;
  const kv = Object.fromEntries(
    readFileSync("/etc/os-release", "utf8")
      .split("\n")
      .map((l) => /^([A-Z_]+)=(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], (m[2] ?? "").replace(/^"|"$/g, "")]),
  );
  return `${kv.ID ?? process.platform}-${kv.VERSION_ID ?? ""}`;
}

export function renderEnvId(): string {
  const parts = [chromiumRevision(), ...fontFingerprint(), osId()];
  return sha(parts.join("\n")).slice(0, 12);
}
