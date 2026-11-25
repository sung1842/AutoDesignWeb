import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadDesignData, standardTree } from "@tastefit/design-spec";
import { copyDeckLimits } from "@tastefit/layout-schema";
import {
  forcedStateCss,
  maxDeck,
  maxText,
  renderBlockSample,
  renderComponentGallery,
  renderStepProbe,
} from "./index.js";

const ROOT = join(import.meta.dirname, "../../..");
const data = loadDesignData(ROOT);
const comps = (
  JSON.parse(readFileSync(join(ROOT, "data/taxonomy/components.json"), "utf8")) as {
    items: { variants?: string[]; states?: Record<string, unknown> }[];
  }
).items;

describe("검사용 렌더: 블록 샘플·단계 프로브·컴포넌트 갤러리(ASM-061)", () => {
  it("maxText 길이 = n·끝 공백 없음, maxDeck는 4.6.2 상한을 채운다", () => {
    for (const n of [1, 10, 24, 90]) {
      expect(maxText(n)).toHaveLength(n);
      expect(maxText(n).endsWith(" ")).toBe(false);
    }
    const d = maxDeck({ "hero.headline": ["짧음"], "value.items": [{ title: "a", body: "b" }] });
    expect((d["hero.headline"]![0] as string).length).toBe(copyDeckLimits()["hero.headline"]);
    expect(((d["value.items"]![0] as Record<string, string>).body ?? "").length).toBe(90);
  });
  it("블록 샘플: 섹션 1개(요청 variant)·footer, 모든 nav 외 variant에서 예외 없음", () => {
    const vs = data.blocks
      .filter((b) => b.id !== "nav")
      .flatMap((b) =>
        (b.variants as { id: string }[]).map((v) => ({ block: b.id as string, variant: v.id })),
      );
    for (const { block, variant } of vs) {
      const html = renderBlockSample(
        { presetId: "PS-T1", block, variant, purpose: "saas", copy: "max" },
        data,
      );
      if (html === null) continue;
      if (block !== "footer") expect(html, variant).toContain(`data-variant="${variant}"`);
      else expect(html).toContain(`data-variant="${variant}"`);
    }
  });
  it("단계 프로브: 9단계 요소", () => {
    const { spec } = standardTree("T1", "saas", data);
    expect(renderStepProbe(spec, data).match(/<p data-step-probe=/g)).toHaveLength(9);
  });
  it("갤러리: 케이스 수 = Σ(true state × variant), 케이스 id 전부 data-case, 상태 강제 CSS", () => {
    const want = comps.reduce(
      (n, c) =>
        n +
        Object.values(c.states ?? {}).filter((v) => v === true).length *
          Math.max(1, (c.variants ?? []).length),
      0,
    );
    const g = renderComponentGallery("PS-T1", data, { copy: "typical" });
    expect(g.cases).toHaveLength(want);
    for (const c of g.cases) expect(g.html).toContain(`data-case="${c}"`);
    expect(forcedStateCss()).toContain('[data-state="hover"]');
    expect(renderComponentGallery("PS-T1", data, { copy: "max" }).html).toContain("가".repeat(10));
  });
});
