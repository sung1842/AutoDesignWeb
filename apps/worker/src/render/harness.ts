// worker 렌더 하네스(Playwright chromium, ASM-025 ①·026 ②·027 ④). M2-09에서 구현한다.
export interface PageLike {
  evaluate<R, A = undefined>(fn: (arg: A) => R, arg?: A): Promise<R>;
}
export interface PageMeasure {
  externalRequests: string[];
  [k: string]: unknown;
}
export interface Harness {
  measure(html: string, vw: number, opts?: { spec?: unknown }): Promise<PageMeasure>;
  withPage<T>(html: string, vw: number, fn: (page: PageLike) => Promise<T>): Promise<T>;
  platformFontsForHangul(html: string, vw: number): Promise<{ selector: string; family: string }[]>;
  firstViewFontBytes(html: string, vw: number): Promise<number>;
  firstViewImageBytes(html: string, vw: number): Promise<number>;
  headlineLines(
    html: string,
    vw: number,
  ): Promise<{ role: string; lines: number; lastLineChars: number }[]>;
  compileInBrowser(spec: unknown, tree: unknown, data: unknown): Promise<string>;
  extractL1(html: string, vw: number): Promise<number[]>;
  parentProbe(html: string): Promise<{ xss: boolean; contentDocumentNull: boolean }>;
  close(): Promise<void>;
}
export function openHarness(): Promise<Harness> {
  return Promise.reject(new Error("openHarness: M2-09에서 구현 예정"));
}
