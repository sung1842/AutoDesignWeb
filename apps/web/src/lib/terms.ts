// legal/*.md → 블록(제목·단락). HTML·링크 문법은 해석하지 않는다(텍스트 그대로 이스케이프 렌더).
export function termsBlocks(md: string): { kind: "h1" | "h2" | "p"; text: string }[] {
  return md
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) =>
      b.startsWith("## ")
        ? { kind: "h2" as const, text: b.slice(3) }
        : b.startsWith("# ")
          ? { kind: "h1" as const, text: b.slice(2) }
          : { kind: "p" as const, text: b },
    );
}
