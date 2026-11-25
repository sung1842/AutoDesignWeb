// 04장 4.5.2 PageSchema(확정 트리)·09장 9.4.4 ⑥ 정적 검사 단위 테스트(ASM-040).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LayoutTreeRawSchema,
  PageSchema,
  bannedKeyPaths,
  layoutTreeRawJsonSchema,
  pageSchemaJsonSchema,
} from "./schema.js";

type Obj = { [k: string]: unknown };
const fx = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../fixtures/layouts/saas-ps1.json", import.meta.url)),
    "utf8",
  ),
) as { raw: Obj };

/** 테스트용 단순 확정: DeckRef를 텍스트로, 이미지를 고정 자산으로 바꾼다(실제 병합기는 M5). */
function confirm(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(confirm);
  if (v === null || typeof v !== "object") return v;
  const o = v as Obj;
  if (typeof o.copy === "string")
    return { copy: { text: "예시", placeholder: true, deck_ref: o.copy } };
  if (o.link && typeof (o.link as Obj).label === "string") {
    const l = o.link as Obj;
    return {
      link: { label: { text: "시작", placeholder: false, deck_ref: l.label }, target: l.target },
    };
  }
  if (o.image)
    return { image: { ...(o.image as Obj), asset_id: "img_001", alt: "", focal: [0.5, 0.5] } };
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, confirm(x)]));
}
function page(): Obj {
  const raw = fx.raw;
  return {
    schemaVersion: "1",
    spec_id: raw.spec_id,
    pattern_id: raw.pattern_id,
    nav: { variant: "nav.split", items: [{ label: "기능", target: "#feature" }] },
    sections: confirm(raw.sections),
    footer: {
      variant: "footer.minimal",
      slots: {
        wordmark: {
          copy: { text: "브랜드", placeholder: false, deck_ref: "deck:footer.tagline#0" },
        },
        businessInfo: {
          copy: { text: "[예시] 주소", placeholder: true, deck_ref: "deck:footer.tagline#0" },
        },
      },
    },
  };
}

describe("PageSchema(확정 트리)", () => {
  it("기준 픽스처를 확정한 트리가 유효하고 role_overrides(타입 단계)도 받는다", () => {
    expect(LayoutTreeRawSchema.safeParse(fx.raw).success).toBe(true);
    const p = page();
    expect(PageSchema.safeParse(p).success).toBe(true);
    (p.sections as Obj[])[0]!.role_overrides = { headline: "t-1" };
    expect(PageSchema.safeParse(p).success).toBe(true);
  });
  it("금지 키·자유 객체·잘못된 단계·nav 6개·섹션 id 중복을 거부한다", () => {
    const cases: ((p: Obj) => void)[] = [
      (p) => void ((p.sections as Obj[])[0]!.style = "x"),
      (p) => void (((p.sections as Obj[])[0]!.slots as Obj).onclick = "x"),
      (p) => void ((p.footer as Obj).html = "x"),
      (p) => void ((p.sections as Obj[])[0]!.role_overrides = { headline: "t-9" }),
      (p) => void ((p.sections as Obj[])[0]!.role_overrides = { media: "t-1" }),
      (p) =>
        void ((p.nav as Obj).items = Array.from({ length: 6 }, () => ({
          label: "a",
          target: "#a1",
        }))),
      (p) => void ((p.sections as Obj[])[1]!.id = "hero"),
      (p) => {
        const h = ((p.sections as Obj[])[0]!.slots as Obj).headline as Obj;
        (h.copy as Obj).className = "x";
      },
    ];
    for (const [i, f] of cases.entries()) {
      const p = page();
      f(p);
      expect(PageSchema.safeParse(p).success, `case ${i}`).toBe(false);
    }
  });
});

describe("9.4.4 ⑥ JSON Schema 정적 검사", () => {
  it("PageSchema·LayoutTreeRaw에 금지 키 경로·열린 객체 0", () => {
    expect(bannedKeyPaths(pageSchemaJsonSchema())).toEqual([]);
    expect(bannedKeyPaths(layoutTreeRawJsonSchema())).toEqual([]);
  });
  it("검사기는 금지 키와 열린 객체를 잡는다", () => {
    const bad = {
      type: "object",
      additionalProperties: false,
      properties: { a: { type: "object", properties: { style: { type: "string" } } } },
    };
    expect(bannedKeyPaths(bad)).toEqual([
      "$.properties.a(열린 객체)",
      "$.properties.a.properties.style",
    ]);
  });
});
