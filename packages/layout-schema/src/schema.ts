// 04장 4.5.2 LayoutTreeRaw·4.6.2 덱 상한(ASM-024 ⑥, ASM-025 ⑤). M2-04에서 채운다.
import { z } from "zod";

/** M2-04 전 자리표시: 모든 입력을 거부한다. */
export const LayoutTreeRawSchema = z.never();
export function layoutTreeRawJsonSchema(): Record<string, unknown> {
  throw new Error("layoutTreeRawJsonSchema: M2-04에서 구현 예정");
}
export function copyDeckLimits(): Record<string, number | Record<string, number>> {
  throw new Error("copyDeckLimits: M2-04에서 구현 예정");
}
