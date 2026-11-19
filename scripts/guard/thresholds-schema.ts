// thresholds-schema (07장 7.12.2 5단계): config/thresholds.json 키 구조를 zod strict로 검사한다.
// 스키마는 고정점(baseRef 시점 07장 spec:thresholds 블록)의 구조에서 만든다. 값이 아닌 키·타입만 본다.
import { z } from "zod";

export function schemaOf(v: unknown): z.ZodType {
  if (v === null) return z.null();
  if (typeof v === "number") return z.number();
  if (typeof v === "string") return z.string();
  if (typeof v === "boolean") return z.boolean();
  if (Array.isArray(v)) {
    const kinds = new Map<string, z.ZodType>();
    for (const e of v) kinds.set(JSON.stringify(shapeKey(e)), schemaOf(e));
    const items = [...kinds.values()];
    if (items.length === 0) return z.array(z.unknown());
    if (items.length === 1) return z.array(items[0] as z.ZodType);
    return z.array(z.union(items as [z.ZodType, z.ZodType, ...z.ZodType[]]));
  }
  const o = v as Record<string, unknown>;
  const shape: Record<string, z.ZodType> = {};
  for (const [k, x] of Object.entries(o)) shape[k] = schemaOf(x);
  return z.strictObject(shape);
}

function shapeKey(v: unknown): unknown {
  if (v === null || typeof v !== "object") return typeof v;
  if (Array.isArray(v)) return v.map(shapeKey);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shapeKey(x)]));
}

/** 문제 목록(빈 배열 = 통과). 각 항목은 "경로: 메시지". */
export function checkThresholdsSchema(spec: unknown, actual: unknown): string[] {
  const r = schemaOf(spec).safeParse(actual);
  if (r.success) return [];
  return r.error.issues.map((i) => {
    const keys = "keys" in i && Array.isArray(i.keys) ? ` [${i.keys.join(", ")}]` : "";
    return `${i.path.join(".") || "(root)"}: ${i.message}${keys}`;
  });
}
