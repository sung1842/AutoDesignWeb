// 토큰 세트(DTCG) → CSS 변수(03장 3.1.12 tokens.css). 순수·isomorphic(04장 4.9.1):
// node API·설정 파일 읽기 없음. design-spec 내보내기와 renderer 컴파일러가 같이 쓴다(ASM-042).
import { TYPE_SPEC } from "./type-spec.js";

type Node = { [k: string]: unknown };
const isObj = (x: unknown): x is Node => typeof x === "object" && x !== null && !Array.isArray(x);
const isTok = (x: unknown): x is Node => isObj(x) && "$type" in x;

/** 리프 토큰을 경로와 함께 모은다. */
export function tokenLeaves(node: unknown, path: string[] = []): { path: string[]; tok: Node }[] {
  if (!isObj(node)) return [];
  if (isTok(node)) return [{ path, tok: node }];
  return Object.entries(node)
    .filter(([k]) => !k.startsWith("$"))
    .flatMap(([k, v]) => tokenLeaves(v, [...path, k]));
}

export const varName = (path: string[]): string => `--tf-${path.join("-")}`;
const rem = (px: number): string => `${Math.round((px / 16) * 10000) / 10000}rem`;
const fmt = (x: number): string => String(Math.round(x * 10000) / 10000);
const em = (x: number): string => (x === 0 ? "0" : `${fmt(x)}em`);

export function cssValue(tok: Node, path: string[]): { main: string; oklch?: string } | null {
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

/** tokens.css 본문(:root 단일 블록, 색은 hex + @supports oklch 재선언). */
export function rootCss(tokenSet: Record<string, unknown>, header: string): string {
  const main: string[] = [];
  const ok: string[] = [];
  const mob: string[] = [];
  for (const { path, tok } of tokenLeaves(tokenSet)) {
    const v = cssValue(tok, path);
    if (!v) continue;
    main.push(`  ${varName(path)}: ${v.main};`);
    if (v.oklch) ok.push(`    ${varName(path)}: ${v.oklch};`);
    if (tok.$type === "typography") {
      // 텍스트 역할 층(3.1.5a)이 참조할 단계별 행간·자간(ASM-043)
      const t = tok.$value as { lineHeight: number; letterSpacing: { value: number } };
      const ext = (tok.$extensions as Node | undefined)?.["app.tastefit"] as
        { mobileLetterSpacing?: number } | undefined;
      main.push(`  ${varName(path)}-leading: ${fmt(t.lineHeight)};`);
      main.push(`  ${varName(path)}-tracking: ${em(t.letterSpacing.value)};`);
      const mls = ext?.mobileLetterSpacing;
      if (mls !== undefined && mls !== t.letterSpacing.value)
        mob.push(`    ${varName(path)}-tracking: ${em(mls)};`);
    }
  }
  return (
    `/* ${header} */\n` +
    `:root {\n${main.join("\n")}\n  @supports (color: oklch(0 0 0)) {\n${ok.join("\n")}\n  }\n` +
    (mob.length ? `  @media (max-width: 47.99rem) {\n${mob.join("\n")}\n  }\n` : "") +
    `}\n`
  );
}
