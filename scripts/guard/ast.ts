// TypeScript AST 도우미. 문자열 안의 텍스트는 코드로 보지 않는다(픽스처 문자열 오탐 방지).
import ts from "typescript";

export function parse(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

export const lineOf = (sf: ts.SourceFile, pos: number): number =>
  sf.getLineAndCharacterOfPosition(pos).line + 1;

/** 파일의 모든 주석(텍스트, 줄). 노드 경계의 주석 범위만 모으므로 문자열·템플릿 안 텍스트는 제외된다. */
export function comments(sf: ts.SourceFile): Array<{ text: string; line: number }> {
  const seen = new Map<number, { text: string; line: number }>();
  const add = (ranges: readonly ts.CommentRange[] | undefined): void => {
    for (const r of ranges ?? []) {
      if (!seen.has(r.pos))
        seen.set(r.pos, { text: sf.text.slice(r.pos, r.end), line: lineOf(sf, r.pos) });
    }
  };
  const visit = (n: ts.Node): void => {
    add(ts.getLeadingCommentRanges(sf.text, n.getFullStart()));
    add(ts.getTrailingCommentRanges(sf.text, n.getEnd()));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  add(ts.getLeadingCommentRanges(sf.text, sf.endOfFileToken.getFullStart()));
  return [...seen.values()];
}

export function walk(node: ts.Node, f: (n: ts.Node) => void): void {
  f(node);
  ts.forEachChild(node, (c) => walk(c, f));
}

/** `a.b.c` 형태의 접근 경로 문자열. */
export function accessPath(n: ts.Node): string | null {
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) {
    const l = accessPath(n.expression);
    return l ? `${l}.${n.name.text}` : null;
  }
  return null;
}

/** 숫자 리터럴 값(단항 - 포함). */
export function numericValue(n: ts.Node): number | null {
  if (ts.isNumericLiteral(n)) return Number(n.text.replace(/_/g, ""));
  if (
    ts.isPrefixUnaryExpression(n) &&
    n.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(n.operand)
  ) {
    return -Number(n.operand.text.replace(/_/g, ""));
  }
  return null;
}

export const COMPARE_OPS = new Set([
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
]);

export { ts };
