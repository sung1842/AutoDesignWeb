// preview 호스트(06장 6.11.4, ASM-027 ⑥). M2-11에서 구현한다.
export type PreviewKind = "candidate" | "version" | "share";
export interface PreviewDeps {
  env: {
    WEB_ORIGIN: string;
    PREVIEW_ORIGIN: string;
    PREVIEW_SIGNING_SECRET: string;
    APP_ENV: string;
  };
  now: () => number;
  loadCandidate: (id: string) => Promise<{ ownerId: string; spec: unknown; tree: unknown } | null>;
  data: unknown;
}
const pending = (n: string): never => {
  throw new Error(`${n}: M2-11에서 구현 예정`);
};
export function signPreview(
  _secret: string,
  _kind: PreviewKind,
  _id: string,
  _vp: number,
  _exp: number,
): string {
  void [_secret, _kind, _id, _vp, _exp];
  return pending("signPreview");
}
export function handlePreview(_req: Request, _deps: PreviewDeps): Promise<Response> {
  void [_req, _deps];
  return Promise.reject(new Error("handlePreview: M2-11에서 구현 예정"));
}
export function issuePreviewUrl(
  _input: { userId: string; kind: PreviewKind; id: string; vp: number },
  _deps: PreviewDeps,
): Promise<{ status: number; url?: string }> {
  void [_input, _deps];
  return Promise.reject(new Error("issuePreviewUrl: M2-11에서 구현 예정"));
}
export function previewFrame(_input: {
  kind: "display" | "measure";
  src?: string;
  srcdoc?: string;
}): string {
  void [_input];
  return pending("previewFrame");
}
