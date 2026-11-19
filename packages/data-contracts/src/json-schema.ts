// JSON Schema 2020-12 최소 검증기(data/tokens/schema.json이 쓰는 키워드만). 의존 패키지 허용 목록에
// 검증기 라이브러리가 없어 직접 둔다(ASM-030). 지원: type·const·enum·required·properties·
// additionalProperties·propertyNames·items·prefixItems·minItems·maxItems·minimum·maximum·pattern·
// $ref(#/$defs/…)·allOf·anyOf·oneOf·not. 그 밖의 키워드는 무시한다.
export type Schema = { [k: string]: unknown } | boolean;

type Json = unknown;
const isObj = (x: Json): x is Record<string, Json> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

function typeOk(t: string, x: Json): boolean {
  switch (t) {
    case "object":
      return isObj(x);
    case "array":
      return Array.isArray(x);
    case "string":
      return typeof x === "string";
    case "number":
      return typeof x === "number" && Number.isFinite(x);
    case "integer":
      return typeof x === "number" && Number.isInteger(x);
    case "boolean":
      return typeof x === "boolean";
    case "null":
      return x === null;
    default:
      return false;
  }
}

const deepEq = (a: Json, b: Json): boolean => JSON.stringify(a) === JSON.stringify(b);

export class MiniValidator {
  private readonly cache = new Map<string, RegExp>();
  constructor(private readonly root: Record<string, unknown>) {}

  private re(p: string): RegExp {
    let r = this.cache.get(p);
    if (!r) {
      r = new RegExp(p, "u");
      this.cache.set(p, r);
    }
    return r;
  }

  private resolve(ref: string): Schema {
    if (!ref.startsWith("#/")) throw new Error(`지원하지 않는 $ref: ${ref}`);
    let node: unknown = this.root;
    for (const part of ref.slice(2).split("/")) {
      if (!isObj(node)) throw new Error(`$ref 해석 실패: ${ref}`);
      node = node[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    if (node === undefined) throw new Error(`$ref 해석 실패: ${ref}`);
    return node as Schema;
  }

  /** 오류 목록(빈 배열 = 통과). path는 JSON Pointer 비슷한 점 표기. */
  validate(schema: Schema, x: Json, path = "$"): string[] {
    if (schema === true) return [];
    if (schema === false) return [`${path}: 허용되지 않음`];
    const s = schema;
    const errs: string[] = [];
    const sub = (k: string): Schema | undefined => s[k] as Schema | undefined;

    if (typeof s.$ref === "string") errs.push(...this.validate(this.resolve(s.$ref), x, path));
    if (typeof s.type === "string" && !typeOk(s.type, x))
      return [...errs, `${path}: type ${s.type}`];
    if (Array.isArray(s.type) && !s.type.some((t) => typeOk(String(t), x)))
      return [...errs, `${path}: type ${s.type.join("|")}`];
    if ("const" in s && !deepEq(s.const, x)) errs.push(`${path}: const ${JSON.stringify(s.const)}`);
    if (Array.isArray(s.enum) && !s.enum.some((e) => deepEq(e, x)))
      errs.push(`${path}: enum ${JSON.stringify(s.enum)}`);

    if (typeof x === "number") {
      if (typeof s.minimum === "number" && x < s.minimum)
        errs.push(`${path}: minimum ${s.minimum}`);
      if (typeof s.maximum === "number" && x > s.maximum)
        errs.push(`${path}: maximum ${s.maximum}`);
    }
    if (typeof x === "string" && typeof s.pattern === "string" && !this.re(s.pattern).test(x))
      errs.push(`${path}: pattern ${s.pattern}`);

    if (Array.isArray(x)) {
      if (typeof s.minItems === "number" && x.length < s.minItems)
        errs.push(`${path}: minItems ${s.minItems}`);
      if (typeof s.maxItems === "number" && x.length > s.maxItems)
        errs.push(`${path}: maxItems ${s.maxItems}`);
      const prefix = Array.isArray(s.prefixItems) ? (s.prefixItems as Schema[]) : [];
      prefix.forEach((ps, i) => {
        if (i < x.length) errs.push(...this.validate(ps, x[i], `${path}[${i}]`));
      });
      const items = sub("items");
      if (items !== undefined)
        for (let i = prefix.length; i < x.length; i += 1)
          errs.push(...this.validate(items, x[i], `${path}[${i}]`));
    }

    if (isObj(x)) {
      if (Array.isArray(s.required))
        for (const k of s.required as string[]) if (!(k in x)) errs.push(`${path}: required ${k}`);
      const props = isObj(s.properties) ? (s.properties as Record<string, Schema>) : {};
      const names = sub("propertyNames");
      const addl = sub("additionalProperties");
      for (const [k, v] of Object.entries(x)) {
        if (names !== undefined) errs.push(...this.validate(names, k, `${path}{${k}}`));
        const ps = props[k];
        if (ps !== undefined) errs.push(...this.validate(ps, v, `${path}.${k}`));
        else if (addl !== undefined) errs.push(...this.validate(addl, v, `${path}.${k}`));
      }
    }

    if (Array.isArray(s.allOf))
      for (const a of s.allOf as Schema[]) errs.push(...this.validate(a, x, path));
    if (Array.isArray(s.anyOf)) {
      const ok = (s.anyOf as Schema[]).some((a) => this.validate(a, x, path).length === 0);
      if (!ok) errs.push(`${path}: anyOf 불일치`);
    }
    if (Array.isArray(s.oneOf)) {
      const n = (s.oneOf as Schema[]).filter((a) => this.validate(a, x, path).length === 0).length;
      if (n !== 1) errs.push(`${path}: oneOf ${n}개 일치`);
    }
    const not = sub("not");
    if (not !== undefined && this.validate(not, x, path).length === 0) errs.push(`${path}: not`);
    return errs;
  }
}
