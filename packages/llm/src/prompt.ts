// 04장 4.7.2 프롬프트 조립(gen_layout·gen_copy). 레퍼런스 유래 텍스트는 어떤 블록에도 넣지 않는다(08장 G5, AC-08-15, ASM-081 ④).
// 입력에 references가 와도 화이트리스트 필드만 골라 쓰므로 출력에 섞이지 않는다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeJson, promptVersionId, type LlmRole } from "./gateway.js";

type Obj = { [k: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const strs = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];

function pkgRoot(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(d, "package.json"))) d = dirname(d);
  return d;
}
const PROMPT_VERSION = 1;

export interface PromptInput {
  brand: unknown;
  spec: unknown;
  purpose: string;
  /** 무시된다(레퍼런스 유래 문자열은 프롬프트에 넣지 않는다). */
  references?: unknown;
  /** BRAND_DATA 경계 id(잡마다 4바이트 hex). 없으면 입력 해시에서 결정적으로 만든다. */
  boundaryId?: string;
}
export interface AssembledPrompt {
  role: LlmRole;
  promptId: string;
  promptSha256: string;
  blocks: { name: string; content: string }[];
  messages: { role: "system" | "user"; content: string }[];
}

const BOUNDARY = /<<<BRAND_DATA_(BEGIN|END)[^>]*>>>/g;
const clean = (s: string): string => s.replace(BOUNDARY, "").normalize("NFC");
/** 자리표시 입력([임시]·[예시])은 브랜드 사실이 아니므로 BRAND_DATA에 넣지 않는다(ASM-087). */
const PLACEHOLDER = /^\s*\[(임시|예시)\]/;
const fact = (s: string): string => (PLACEHOLDER.test(s) ? "" : clean(s));

/** 4.7.2 BRAND_DATA: 레이아웃 = purpose·primary_action·key_points 개수, 카피 = BrandInput(brand_color 제외). */
function brandData(role: LlmRole, brand: unknown, purpose: string): Obj {
  const b = isObj(brand) ? brand : {};
  const kp = (strs(b.key_points).length ? strs(b.key_points) : strs(b.keyPoints)).filter(
    (x) => !PLACEHOLDER.test(x),
  );
  const action = str(b.primary_action) || str(b.primaryAction);
  if (role === "gen_layout")
    return { purpose, primary_action: action, key_points_count: kp.length };
  return {
    name: clean(str(b.name)),
    description: fact(str(b.description)),
    purpose,
    primary_action: action,
    audience: fact(str(b.audience)),
    key_points: kp.map(clean),
    is_sample: b.is_sample === true,
  };
}
function designSpec(role: LlmRole, spec: unknown, purpose: string): Obj {
  const s = isObj(spec) ? spec : {};
  const l2 = isObj(s.l2) ? s.l2 : {};
  const copy = isObj(s.copy) ? s.copy : {};
  const sig = isObj(s.signature) ? s.signature : {};
  if (role === "gen_copy") return { purpose, type_id: s.type_id ?? null, copy };
  return {
    variant: s.variant ?? null,
    purpose,
    type_id: s.type_id ?? null,
    theme: s.theme ?? null,
    layout_constraints: s.layout_constraints ?? null,
    signature: { id: sig.id ?? null, apply_to: sig.apply_to ?? [] },
    headline_option_preference: copy.headline_option_preference ?? [],
    l2: {
      grid_mode: l2["layout.grid_mode"] ?? null,
      "media.mode": l2["media.mode"] ?? null,
      density: l2["space.density"] ?? null,
    },
  };
}

export function assemblePrompt(
  role: "gen_layout" | "gen_copy",
  input: PromptInput,
): AssembledPrompt {
  const promptId = promptVersionId(role, PROMPT_VERSION);
  const system = readFileSync(join(pkgRoot(), "prompts", `${promptId}.md`), "utf8");
  const bd = brandData(role, input.brand, input.purpose);
  const id =
    input.boundaryId ??
    createHash("sha256").update(normalizeJson({ role, bd })).digest("hex").slice(0, 8);
  const blocks = [
    { name: "SYSTEM", content: system },
    { name: "DESIGN_SPEC", content: JSON.stringify(designSpec(role, input.spec, input.purpose)) },
    {
      name: "BRAND_DATA",
      content: `<<<BRAND_DATA_BEGIN id=${id}>>>\n${JSON.stringify(bd)}\n<<<BRAND_DATA_END id=${id}>>>`,
    },
  ];
  return {
    role,
    promptId,
    promptSha256: createHash("sha256").update(system).digest("hex"),
    blocks,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: blocks
          .slice(1)
          .map((b) => `[${b.name}]\n${b.content}`)
          .join("\n\n"),
      },
    ],
  };
}
