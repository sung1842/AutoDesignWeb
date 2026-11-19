// 03장 3.1.12 내보내기 토큰 파일 3종(tokens.json·tokens.css·theme.css). 순수 함수.
import type { L2 } from "@tastefit/taxonomy";
import { TYPE_SPEC } from "./tokens.js";
import type { DerivedTokens } from "./types.js";

type Node = { [k: string]: unknown };
const isObj = (x: unknown): x is Node => typeof x === "object" && x !== null && !Array.isArray(x);
const isTok = (x: unknown): x is Node => isObj(x) && "$type" in x;

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

/** 리프 토큰을 경로와 함께 모은다. */
export function tokenLeaves(node: unknown, path: string[] = []): { path: string[]; tok: Node }[] {
  if (!isObj(node)) return [];
  if (isTok(node)) return [{ path, tok: node }];
  return Object.entries(node)
    .filter(([k]) => !k.startsWith("$"))
    .flatMap(([k, v]) => tokenLeaves(v, [...path, k]));
}

const varName = (path: string[]): string => `--tf-${path.join("-")}`;
const rem = (px: number): string => `${Math.round((px / 16) * 10000) / 10000}rem`;
const fmt = (x: number): string => String(Math.round(x * 10000) / 10000);

function cssValue(tok: Node, path: string[]): { main: string; oklch?: string } | null {
  const v = tok.$value;
  switch (tok.$type) {
    case "color": {
      const c = v as { hex: string; components: number[]; alpha?: number };
      const a = c.alpha ?? 1;
      const [l, ch, h] = c.components.map((x) => fmt(x));
      if (a < 1) {
        const hex = c.hex.slice(1);
        const rgb = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(" ");
        return { main: `rgb(${rgb} / ${fmt(a)})`, oklch: `oklch(${l} ${ch} ${h} / ${fmt(a)})` };
      }
      return { main: c.hex, oklch: `oklch(${l} ${ch} ${h})` };
    }
    case "dimension": {
      const d = v as { value: number };
      return { main: d.value === 0 ? "0" : rem(d.value) };
    }
    case "number":
      return { main: fmt(v as number) };
    case "fontWeight":
      return { main: String(v) };
    case "fontFamily":
      return {
        main: (Array.isArray(v) ? v : [v])
          .map((f) =>
            /^[a-z-]+$/.test(String(f)) && !String(f).startsWith("tf-")
              ? String(f)
              : `"${String(f)}"`,
          )
          .join(", "),
      };
    case "duration":
      return { main: `${(v as { value: number }).value}ms` };
    case "cubicBezier":
      return { main: `cubic-bezier(${(v as number[]).map(fmt).join(", ")})` };
    case "typography": {
      // 타입 단계는 clamp 식(3.1.5 보간). 나머지 속성은 개별 변수로 둔다
      const t = v as { fontSize: { value: number } };
      const m =
        (
          (tok.$extensions as Node | undefined)?.["app.tastefit"] as
            { mobileSize?: number } | undefined
        )?.mobileSize ?? t.fontSize.value;
      const d = t.fontSize.value;
      if (m === d) return { main: rem(d) };
      const span = (TYPE_SPEC.vwDesktop - TYPE_SPEC.vwMobile) / 100;
      const B = (d - m) / span;
      const A = m - B * (TYPE_SPEC.vwMobile / 100);
      return { main: `clamp(${rem(m)}, calc(${rem(A)} + ${fmt(B)}vw), ${rem(d)})` };
    }
    case "shadow": {
      const layers = (Array.isArray(v) ? v : [v]) as Node[];
      if (layers.length === 0) return { main: "none" };
      return {
        main: layers
          .map((l) => {
            const c = l.color as { hex: string; alpha?: number };
            const a = c.alpha ?? 1;
            const hex = c.hex.slice(1);
            const rgb = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(" ");
            const n = (k: string): string => {
              const x = (l[k] as { value: number }).value;
              return x === 0 ? "0" : rem(x);
            };
            return `${n("offsetX")} ${n("offsetY")} ${n("blur")} ${n("spread")} rgb(${rgb} / ${fmt(a)})`;
          })
          .join(", "),
      };
    }
    case "border": {
      const b = v as { color: { hex: string }; width: { value: number }; style: string };
      return { main: `${rem(b.width.value)} ${b.style} ${b.color.hex}` };
    }
    default:
      void path;
      return null;
  }
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

  // tokens.css: :root 단일 블록, 색은 hex + @supports oklch 재선언
  const main: string[] = [];
  const ok: string[] = [];
  for (const { path, tok } of tokenLeaves(ts)) {
    const v = cssValue(tok, path);
    if (!v) continue;
    main.push(`  ${varName(path)}: ${v.main};`);
    if (v.oklch) ok.push(`    ${varName(path)}: ${v.oklch};`);
  }
  // @supports는 :root 안에 중첩(단일 블록 유지, 같은 명시도로 뒤에서 재선언)
  const css =
    `/* TasteFit tokens-1 · ${meta.presetId} · ${meta.taxonomyVersion} */\n` +
    `:root {\n${main.join("\n")}\n  @supports (color: oklch(0 0 0)) {\n${ok.join("\n")}\n  }\n}\n`;

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
