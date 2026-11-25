// worker render 잡(D-25, 06장 6.8.3, ASM-027 ⑤·ASM-058): 뷰포트 5종 전체 페이지 PNG.
// 외부 요청은 하네스 route가 전부 막는다 → externalRequests(실제로 나간 요청)는 항상 비고, 막은 수를 render_blocked_requests로 낸다.
import { getThresholds } from "@tastefit/config";
import type { Harness } from "../render/harness.js";

export interface RenderJobResult {
  screenshots: { viewport: number; png: Buffer }[];
  renderBlockedRequests: number;
  externalRequests: string[];
}

export async function runRenderJob(input: { html: string }, h: Harness): Promise<RenderJobResult> {
  const gen = getThresholds().generation as { renderViewports?: number[] } | undefined;
  const viewports = gen?.renderViewports ?? [];
  if (viewports.length === 0) throw new Error("generation.renderViewports 없음");
  const screenshots: RenderJobResult["screenshots"] = [];
  const blocked = new Set<string>();
  for (const vw of viewports) {
    const r = await h.screenshot(input.html, vw);
    screenshots.push({ viewport: vw, png: r.png });
    for (const u of r.blocked) blocked.add(u);
  }
  return { screenshots, renderBlockedRequests: blocked.size, externalRequests: [] };
}
