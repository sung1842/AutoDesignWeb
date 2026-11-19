// worker render 잡(D-25, ASM-027 ⑤). M2-10에서 구현한다.
import type { Harness } from "../render/harness.js";
export interface RenderJobResult {
  screenshots: { viewport: number; png: Buffer }[];
  renderBlockedRequests: number;
  externalRequests: string[];
}
export function runRenderJob(_input: { html: string }, _h: Harness): Promise<RenderJobResult> {
  void [_input, _h];
  return Promise.reject(new Error("runRenderJob: M2-10에서 구현 예정"));
}
