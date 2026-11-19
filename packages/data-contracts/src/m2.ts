// M2 계약(ASM-023·024·025): DesignSpec zod·TokenSet·묶음 검증. M2-03에서 채운다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { MiniValidator, type Schema } from "./json-schema.js";

/** 04장 4.2.1 DesignSpec. M2-03 전 자리표시(키 없음 → 수용 테스트 실패가 정상). */
export const DesignSpecSchema = z.object({});

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
const pending = (name: string): ValidationResult => ({
  ok: false,
  errors: [`${name}: M2-03에서 구현 예정`],
});

/** data/tokens/schema.json(tokens-1) 검증. */
let tokenSchema: { v: MiniValidator; s: Schema } | null = null;
function loadTokenSchema(): { v: MiniValidator; s: Schema } {
  if (tokenSchema) return tokenSchema;
  // src·dist 어디서든 패키지 위 두 단계가 저장소 루트
  const p = fileURLToPath(new URL("../../../data/tokens/schema.json", import.meta.url));
  const env = JSON.parse(readFileSync(p, "utf8")) as { items: { id: string; schema: Schema }[] };
  const item = env.items.find((i) => i.id === "tokens-1");
  if (!item || typeof item.schema !== "object") throw new Error("tokens-1 스키마 없음");
  tokenSchema = { v: new MiniValidator(item.schema), s: item.schema };
  return tokenSchema;
}
export function validateTokenSet(x: unknown): ValidationResult {
  const { v, s } = loadTokenSchema();
  const errors = v.validate(s, x);
  return { ok: errors.length === 0, errors };
}
/** 묶음 파일 하나를 경로로 골라 zod 검증. */
export function validateBundle(_path: string, _json: unknown): ValidationResult {
  void [_path, _json];
  return pending("validateBundle");
}
