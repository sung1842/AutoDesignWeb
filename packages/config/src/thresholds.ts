// 임계값 단일 원천 로더(09장 9.5.6, 07장 7.12.1). config/thresholds.json만 읽는다.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type Json =
  number | string | boolean | null | readonly Json[] | { readonly [k: string]: Json };
export type JsonObject = { readonly [k: string]: Json };

/** cwd에서 위로 올라가며 config/thresholds.json이 있는 저장소 루트를 찾는다. */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error(`저장소 루트를 찾지 못함: ${start}`);
    dir = up;
  }
}

const cache = new Map<string, JsonObject>();

function load(root: string, file: string): JsonObject {
  const p = join(root, "config", file);
  const hit = cache.get(p);
  if (hit) return hit;
  const v = JSON.parse(readFileSync(p, "utf8")) as JsonObject;
  cache.set(p, Object.freeze(v));
  return v;
}

/** config/thresholds.json(spec:extract 산출, 잠금). 판정 코드는 이 함수로만 임계값을 읽는다. */
export function getThresholds(root: string = findRepoRoot()): JsonObject {
  return load(root, "thresholds.json");
}

/** config/test-policy.json(spec:extract 산출, 잠금). */
export function getTestPolicy(root: string = findRepoRoot()): JsonObject {
  return load(root, "test-policy.json");
}

/** 점 표기 경로로 숫자 임계값을 꺼낸다. 없거나 숫자가 아니면 예외. */
export function thresholdNumber(path: string, t: JsonObject = getThresholds()): number {
  let cur: Json = t;
  for (const k of path.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur))
      throw new Error(`임계값 경로 없음: ${path}`);
    cur = (cur as JsonObject)[k] ?? null;
  }
  if (typeof cur !== "number") throw new Error(`숫자 임계값 아님: ${path}`);
  return cur;
}
