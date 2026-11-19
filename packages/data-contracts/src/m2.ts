// M2 계약(ASM-023·024·025): DesignSpec zod·TokenSet·묶음 검증. M2-03에서 채운다.
import { z } from "zod";

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
export function validateTokenSet(_x: unknown): ValidationResult {
  void [_x];
  return pending("validateTokenSet");
}
/** 묶음 파일 하나를 경로로 골라 zod 검증. */
export function validateBundle(_path: string, _json: unknown): ValidationResult {
  void [_path, _json];
  return pending("validateBundle");
}
