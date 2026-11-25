// 03장 3.1.12 내보내기 토큰 파일 3종(tokens.json·tokens.css·theme.css). 순수 함수.
import type { L2 } from "@tastefit/taxonomy";
import { rootCss, tokenLeaves, varName } from "./tokens-css.js";
import type { DerivedTokens } from "./types.js";

type Node = { [k: string]: unknown };
const isObj = (x: unknown): x is Node => typeof x === "object" && x !== null && !Array.isArray(x);
const isTok = (x: unknown): x is Node => isObj(x) && "$type" in x;
export { tokenLeaves } from "./tokens-css.js";

/** 시맨틱 → 원시 별칭(3.1.2 "가능한 한 원시 토큰 참조"). 값이 같을 때만 별칭으로 바꾼다. */
const ALIASES: readonly [string, string][] = [
  ["color.focus-inverse", "color.fg-inverse"],
  ["shadow.color", "color.neutral.950"],
  ["media.duotone-shadow", "color.neutral.950"],
];

function get(root: Node, path: string): unknown {
  let cur: unknown = root;
  for (const k of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export interface ExportMeta {
  presetId: string;
  l2: L2;
  taxonomyVersion: string;
}

export function exportTokensImpl(d: DerivedTokens, meta: ExportMeta): Record<string, string> {
  const ts = structuredClone(d.tokenSet) as Node;
  // tokens.json: 별칭 유지 + 확장 메타
  const json = structuredClone(ts);
  for (const [from, to] of ALIASES) {
    const a = get(json, from);
    const b = get(json, to);
    if (isTok(a) && isTok(b) && JSON.stringify(a.$value) === JSON.stringify(b.$value))
      a.$value = `{${to}}`;
  }
  json.$extensions = {
    "app.tastefit": {
      presetId: meta.presetId,
      taxonomyVersion: meta.taxonomyVersion,
      l2: { ...meta.l2 },
      accentTextSafe: d.accentTextSafe,
      inverseButtonMode: d.inverseButtonMode,
    },
  };

  // tokens.css: :root 단일 블록, @supports는 :root 안에 중첩(같은 명시도로 뒤에서 재선언)
  const css = rootCss(ts, `TasteFit tokens-1 · ${meta.presetId} · ${meta.taxonomyVersion}`);

  // theme.css: Tailwind v4 @theme, 기본 팔레트·radius·shadow 초기화 후 재정의
  const th: string[] = [
    "  --color-*: initial;",
    "  --radius-*: initial;",
    "  --shadow-*: initial;",
    "  --font-*: initial;",
    "  --breakpoint-md: 48rem;",
    "  --breakpoint-lg: 64rem;",
    "  --breakpoint-xl: 80rem;",
    "  --breakpoint-2xl: 96rem;",
  ];
  const color = ts.color as Node;
  for (const { path } of tokenLeaves(color))
    th.push(`  --color-${path.join("-")}: var(${varName(["color", ...path])});`);
  for (const k of Object.keys(ts.radius as Node))
    th.push(`  --radius-${k}: var(--tf-radius-${k});`);
  for (const k of Object.keys(ts.shadow as Node))
    if (k.startsWith("level-")) th.push(`  --shadow-${k}: var(--tf-shadow-${k});`);
  for (const k of Object.keys(ts.font as Node))
    if (k !== "weight") th.push(`  --font-${k}: var(--tf-font-${k});`);
  const theme = `@import "./tokens.css";\n@theme {\n${th.join("\n")}\n}\n`;

  return {
    "tokens/tokens.json": `${JSON.stringify(json, null, 2)}\n`,
    "tokens/tokens.css": css,
    "tokens/theme.css": theme,
  };
}
