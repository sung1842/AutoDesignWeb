// data/ 묶음 읽기 공용(data:validate·seed:temp·db:seed). 레지스트리(packages/data-contracts)의 배치 형식을 따른다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { BundleDef } from "../../packages/data-contracts/src/index.js";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Obj = { [k: string]: Json };

export interface LoadedFile {
  path: string; // 루트 기준
  json?: Json;
  text?: string;
  error?: string;
}

export function walk(root: string, rel: string): string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs)
    .sort()
    .flatMap((n) => walk(root, join(rel, n)));
}

/** 묶음의 파일 목록(디렉터리형은 *.json만). */
export function bundleFiles(root: string, def: BundleDef): string[] {
  return def.paths.flatMap((p) => {
    const files = walk(root, p);
    return def.layout === "envelopeDir" || def.layout === "itemDir"
      ? files.filter((f) => f.endsWith(".json"))
      : files;
  });
}

export function loadFile(root: string, path: string): LoadedFile {
  const text = readFileSync(join(root, path), "utf8");
  if (!path.endsWith(".json")) return { path, text };
  try {
    return { path, json: JSON.parse(text) as Json, text };
  } catch (e) {
    return { path, text, error: `JSON 파싱 실패: ${(e as Error).message}` };
  }
}

/** 봉투면 items, 아니면 객체 자신. */
export function itemsOf(j: Json | undefined): Obj[] {
  if (j && typeof j === "object" && !Array.isArray(j) && Array.isArray(j.items))
    return j.items as Obj[];
  return j && typeof j === "object" && !Array.isArray(j) ? [j] : [];
}

/** 묶음의 전체 항목(파일 순서). */
export function bundleItems(root: string, def: BundleDef): Obj[] {
  return bundleFiles(root, def).flatMap((f) => itemsOf(loadFile(root, f).json));
}

export const rel = (root: string, p: string): string => relative(root, p);
