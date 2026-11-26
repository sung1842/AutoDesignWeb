// packages/scoring/fixtures/<id>/{pass,fail}-{1,2}.json 생성(04장 AC-04-19, ASM-078 ①·ASM-084). 결정적.
// 사용: pnpm exec tsx scripts/data/gen-scoring-fixtures.ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fallbackMockup,
  l2Conflicts,
  loadDesignData,
  standardTree,
} from "../../packages/design-spec/src/index.js";

type J = unknown;
const ROOT = join(import.meta.dirname, "../..");
const OUT = join(ROOT, "packages/scoring/fixtures");
const data = loadDesignData(ROOT);

const fx: Record<string, [J, J, J, J]> = {};
const lch = (l: number, c: number, h: number): J => ({
  $type: "color",
  $value: { colorSpace: "oklch", components: [l, c, h], alpha: 1 },
});

// ---------- G-01: 명세 + 확정 트리 ----------
const a = fallbackMockup("T1", "local_business", "v_true", data) as { spec: J; tree: J };
const b = fallbackMockup("T5", "saas", "v_true", data) as { spec: J; tree: J };
const tb = structuredClone(b.tree) as { sections: { block: string }[] };
const heroLast = { ...tb, sections: [...tb.sections.slice(1), tb.sections[0]] };
fx["G-01"] = [
  { spec: a.spec, tree: a.tree },
  { spec: b.spec, tree: b.tree },
  { spec: b.spec, tree: heroLast },
  { spec: a.spec, tree: { schemaVersion: "1", sections: "없음" } },
];

// ---------- 측정 게이트(하네스 PageMeasure 모양) ----------
fx["G-02"] = [
  { vw: 1280, texts: [{ sel: "h1", text: "원두", ratio: 12.1, large: true }] },
  {
    measures: [
      { vw: 1280, texts: [{ sel: "p", text: "본문", ratio: 4.6, large: false }] },
      { vw: 375, texts: [{ sel: "h2", text: "큰 글자", ratio: 3.1, large: true }] },
    ],
  },
  { vw: 1280, texts: [{ sel: "p", text: "흐린 본문", ratio: 3.2, large: false }] },
  { measures: [{ vw: 375, texts: [{ sel: "h2", text: "큰 글자", ratio: 2.4, large: true }] }] },
];
fx["G-03"] = [
  { vw: 1280, ui: [{ sel: "input", kind: "border", ratio: 3.4 }] },
  { vw: 375, ui: [{ sel: "button", kind: "focus", ratio: 7 }] },
  { vw: 1280, ui: [{ sel: "input", kind: "border", ratio: 1.6 }] },
  { vw: 375, ui: [{ sel: "a.btn", kind: "boundary", ratio: 2.9 }] },
];
fx["G-04"] = [
  { vw: 1280, scrollWidth: 1280, innerWidth: 1280 },
  { measures: [375, 768, 1024, 1280, 1920].map((w) => ({ vw: w, scrollWidth: w, innerWidth: w })) },
  { vw: 375, scrollWidth: 412, innerWidth: 375 },
  { measures: [{ vw: 1920, scrollWidth: 1921, innerWidth: 1920 }] },
];
fx["G-05"] = [
  { vw: 1280, clipped: [] },
  { vw: 375 },
  { vw: 375, clipped: ["[data-role='hero.headline']"] },
  { measures: [{ vw: 768, clipped: ["p.tf-faq__a"] }] },
];
fx["G-06"] = [
  { vw: 1280, overlaps: [] },
  { vw: 375, overlaps: [] },
  { vw: 375, overlaps: ["h1 × a.btn 24px²"] },
  { vw: 1280, overlaps: ["p × p 6px²"] },
];
fx["G-07"] = [
  { vw: 1280, brokenImages: [], fontErrors: [], consoleErrors: [], externalRequests: [] },
  { vw: 375 },
  { vw: 1280, externalRequests: ["https://fonts.googleapis.com/css2"] },
  { vw: 375, brokenImages: ["/assets/images/missing.jpg"] },
];
const ref = {
  colors: [
    { name: "fg", hex: "#222222", alpha: 1 },
    { name: "bg", hex: "#FFFFFF", alpha: 1 },
  ],
  radii: [0, 4],
  spaces: [0, 8, 16],
  fontSizes: { "t-body": 18, "t-1": 48 },
  tolerancePx: 0.5,
  deltaEOk: 0.01,
};
const styles = (over: Record<string, J> = {}): J => ({
  fonts: [{ sel: "p", role: "body", px: 18 }],
  colors: [{ sel: "p", prop: "color", rgba: [34, 34, 34, 1] }],
  radii: [{ sel: "button", prop: "border-radius", px: 4 }],
  spaces: [{ sel: "section", prop: "padding-top", px: 16 }],
  ...over,
});
fx["G-12"] = [
  { vw: 1280, styles: styles(), integrity: { ref, drift: [] } },
  {
    vw: 375,
    styles: styles({ fonts: [{ sel: "h1", role: "hero.headline", px: 48.2 }] }),
    integrity: { ref, drift: [] },
  },
  { vw: 1280, styles: styles(), integrity: { ref, drift: ["color.bg"] } },
  {
    vw: 1280,
    styles: styles({ spaces: [{ sel: "div", prop: "padding-left", px: 13 }] }),
    integrity: { ref, drift: [] },
  },
];

// ---------- 결과 입력 게이트 ----------
fx["G-08"] = [
  {
    axe: [
      { vw: 1280, violations: [] },
      { vw: 375, violations: [] },
    ],
  },
  { axe: [{ vw: 1280, violations: [{ id: "region", impact: "moderate" }] }] },
  { axe: [{ vw: 375, violations: [{ id: "button-name", impact: "critical" }] }] },
  { axe: [{ vw: 1280, violations: [{ id: "image-alt", impact: "serious" }] }] },
];
fx["G-09"] = [
  { lint: [] },
  { lint: [{ rule: "AIL-15", severity: "warn", message: "상투 CTA 3회" }] },
  { lint: [{ rule: "AIL-13", severity: "error", message: "금지 문구" }] },
  {
    lint: [
      { rule: "AIL-24", severity: "warn", message: "고아" },
      { rule: "AIL-01", severity: "error", message: "보라~파랑" },
    ],
  },
];
fx["G-10"] = [
  {
    brandName: "한결로스터리",
    nav: ["한결로스터리"],
    hero: ["한결로스터리의 아침"],
    footer: ["© 한결로스터리"],
  },
  {
    brandName: "모아노트",
    nav: ["모아노트"],
    hero: ["모아노트로 회의록 정리"],
    footer: ["모아노트".normalize("NFD")],
  },
  {
    brandName: "한결로스터리",
    nav: ["한결로스터리"],
    hero: ["매일 아침 볶는 원두"],
    footer: ["© 한결로스터리"],
  },
  { brandName: "한결로스터리", nav: [], hero: ["한결로스터리"], footer: [] },
];
const rep = (passed: boolean, violated: string[]): J => ({
  config_version: "2027-S1.1",
  passed,
  violated,
  nearest_reference_id: "00000000-0000-4000-8000-000000000001",
  g2_matches: passed ? 2 : 5,
  g2_matched_attrs: passed
    ? ["radius", "depth"]
    : ["display", "body", "primary", "radius", "depth"],
  min_phash_distance: passed ? 30 : 4,
  min_phash_reference_id: "00000000-0000-4000-8000-000000000001",
  g5_max_run: 3,
});
fx["G-11"] = [
  { originality: rep(true, []) },
  { originality: { ...(rep(true, []) as object), g2_matches: 3 } },
  { originality: rep(false, ["G2"]) },
  { originality: rep(false, ["G3", "G5"]) },
];
fx["G-13"] = [
  { texts: ["한결로스터리", "성수동에서 매일 볶는 원두"] },
  { texts: ["모아노트", "회의록을 10분 만에 정리합니다"] },
  { texts: ["국민은행 고객센터 안내"] },
  { texts: ["한결로스터리", "환급금 조회는 여기서"] },
];

// ---------- 조화 H1~H12 ----------
const spec = (over: Record<string, J>): J => ({ tokens: {}, ...over });
fx.H1 = [
  {
    render: {
      brandColors: [
        [0.5, 0.12, 30],
        [0.7, 0.1, 200],
      ],
    },
  },
  {
    render: {
      brandColors: [
        [0.5, 0.12, 30],
        [0.5, 0.121, 30],
        [0.8, 0.08, 90],
      ],
    },
  },
  {
    render: {
      brandColors: [
        [0.5, 0.12, 30],
        [0.6, 0.12, 100],
        [0.7, 0.12, 170],
        [0.4, 0.12, 250],
      ],
    },
  },
  {
    render: {
      brandColors: [
        [0.5, 0.12, 30],
        [0.6, 0.12, 100],
        [0.7, 0.12, 170],
        [0.4, 0.12, 250],
        [0.8, 0.1, 320],
      ],
    },
  },
];
fx.H2 = [
  { spec: spec({ tokens: { color: { primary: lch(0.5, 0.12, 30) } } }) },
  {
    spec: spec({ tokens: { color: { primary: lch(0.5, 0.12, 30), accent: lch(0.7, 0.12, 60) } } }),
  },
  {
    spec: spec({ tokens: { color: { primary: lch(0.5, 0.12, 30), accent: lch(0.7, 0.12, 120) } } }),
  },
  {
    spec: spec({ tokens: { color: { primary: lch(0.5, 0.12, 30), accent: lch(0.7, 0.12, 280) } } }),
  },
];
fx.H3 = [
  {
    spec: spec({
      tokens: {
        color: { primary: lch(0.5, 0.12, 30), accent: lch(0.7, 0.14, 60), bg: lch(0.98, 0.01, 80) },
      },
    }),
  },
  {
    spec: spec({
      theme: "light",
      tokens: { color: { primary: lch(0.3, 0.01, 30), bg: lch(0.98, 0.02, 80) } },
    }),
  },
  {
    spec: spec({
      tokens: {
        color: { primary: lch(0.5, 0.1, 30), accent: lch(0.7, 0.2, 60), bg: lch(0.98, 0.01, 80) },
      },
    }),
  },
  { spec: spec({ tokens: { color: { primary: lch(0.5, 0.1, 30), bg: lch(0.95, 0.09, 80) } } }) },
];
fx.H4 = [
  { render: { fontFamilies: ["Nanum Myeongjo", "Pretendard"] } },
  { render: { fontFamilies: ["Pretendard", "JetBrains Mono"] } },
  { render: { fontFamilies: ["Nanum Myeongjo", "Pretendard", "Gowun Dodum"] } },
  { render: { fontFamilies: ["A", "B", "C", "D"] } },
];
fx.H5 = [
  { render: { fontWeights: [400, 700] } },
  { render: { fontWeights: [400, 500, 700] } },
  { render: { fontWeights: [300, 400, 500, 700] } },
  { render: { fontWeights: [300, 400, 500, 600, 700] } },
];
fx.H6 = [
  { render: { typeScaleRatio: 1 } },
  { render: { typeScaleRatio: 0.96 } },
  { render: { typeScaleRatio: 0.92 } },
  { render: { typeScaleRatio: 0.5 } },
];
fx.H7 = [
  { render: { displayPx: 72, bodyPx: 18 } },
  { render: { displayPx: 45, bodyPx: 18 } },
  { render: { displayPx: 36, bodyPx: 18 } },
  { render: { displayPx: 160, bodyPx: 18 } },
];
fx.H8 = [
  { render: { spacingRatio: 1 } },
  { render: { spacingRatio: 0.95 } },
  { render: { spacingRatio: 0.9 } },
  { render: { spacingRatio: 0.7 } },
];
fx.H9 = [
  { render: { radiusRatio: 1 } },
  { spec: spec({ l2: { "shape.radius_family": "sharp" } }), render: { radiusRatio: 1 } },
  { render: { radiusRatio: 0.97 } },
  { render: { radiusRatio: 0.5 } },
];
fx.H10 = [
  { spec: spec({ forbidden: { conflict_ids: [] } }) },
  { spec: spec({ l2: { "depth.style": "flat" } }), conflicts: [] },
  { spec: spec({ forbidden: { conflict_ids: ["CF-03"] } }) },
  { spec: spec({}), conflicts: ["CF-07"] },
];
fx.H11 = [
  { spec: spec({ decor: { max: 2, effects: ["grain"] } }) },
  { spec: spec({ decor: { max: 2, effects: ["grain", "rule-lines"] } }) },
  { spec: spec({ decor: { max: 1, effects: ["grain", "rule-lines"] } }) },
  { spec: spec({ decor: { max: 0, effects: ["grain", "rule-lines"] } }) },
];
fx.H12 = [
  { violations: [] },
  { violations: [{ rule: "AIL-15" }, { rule: "RH-01" }] },
  { violations: [{ rule: "LT-05" }] },
  {
    violations: [
      { rule: "LT-06" },
      { rule: "LT-07" },
      { rule: "LT-08" },
      { rule: "LT-05" },
      { rule: "LT-06" },
    ],
  },
];

// ---------- AC-03-39 상충 CF-01~CF-12 픽스처(conflicts/CF-xx/fail-1.json = {cf, spec, tree}) ----------
type AnySpec = Record<string, unknown> & {
  l2: Record<string, string>;
  tokens: Record<string, unknown>;
};
const base = standardTree("T1", "saas", data) as unknown as {
  spec: AnySpec;
  tree: Record<string, unknown>;
};
const clone = <T>(x: T): T => structuredClone(x);
const withL2 = (sp: AnySpec, l2: Record<string, string>, typeId?: string, d = data): AnySpec => {
  const out = clone(sp);
  out.l2 = { ...out.l2, ...l2 };
  if (typeId) out.type_id = typeId;
  const ids = l2Conflicts(out.l2 as never, { typeId: String(out.type_id), purpose: "saas" }, d);
  out.forbidden = { ...(out.forbidden as object), conflict_ids: ids };
  return out;
};
const plainTree = {
  sections: [{ id: "hero", block: "hero", variant: "hero.type-only", bg: "bg", pad: 1, slots: {} }],
};
const px = (v: number): J => ({ value: v, unit: "px" });
const pillPreset = data.presets.find(
  (p) => (p as unknown as { buttonPill?: boolean }).buttonPill === true,
);
// CF-04 조합(고대비 세리프 + 기하 고딕 본문)은 temp 페어링 20쌍에 없어(컴파일이 막는 조합) 대비 세리프 페어링 1쌍의
// 본문 분류만 sans_geometric으로 바꾼 가상 데이터로 l2Conflicts를 돌린다
const serifPair = data.pairings.find(
  (p) => (p as unknown as { contrastSerif?: boolean }).contrastSerif === true,
);
const dataCf04 = {
  ...data,
  pairings: data.pairings.map((p) => (p === serifPair ? { ...p, classBody: "sans_geometric" } : p)),
} as typeof data;
const vividPal = data.palettes.find(
  (p) => (p as unknown as { chroma?: string }).chroma === "vivid",
);
const conflicts: Record<string, { spec: J; tree: J }> = {
  "CF-01": { spec: withL2(base.spec, { "depth.style": "glass" }), tree: plainTree },
  "CF-02": {
    spec: (() => {
      const sp = clone(base.spec);
      sp.tokens.shadow = {
        "level-1": {
          $type: "shadow",
          $value: [{ offsetX: px(6), offsetY: px(6), blur: px(0), spread: px(0) }],
        },
        "level-2": {
          $type: "shadow",
          $value: [{ offsetX: px(0), offsetY: px(8), blur: px(24), spread: px(0) }],
        },
      };
      return sp;
    })(),
    tree: base.tree,
  },
  "CF-03": {
    spec: withL2(base.spec, { "shape.radius_family": "sharp" }, pillPreset?.typeId),
    tree: base.tree,
  },
  "CF-04": {
    spec: withL2(
      base.spec,
      { "type.pairing_id": serifPair?.code ?? "", "shape.radius_family": "round" },
      undefined,
      dataCf04,
    ),
    tree: base.tree,
  },
  "CF-05": {
    spec: {
      ...withL2(base.spec, { "depth.style": "glass" }),
      signature: { id: "SIG-07", intensity: 1, apply_to: [] },
    },
    tree: base.tree,
  },
  "CF-06": {
    spec: (() => {
      const sp = clone(base.spec);
      sp.theme = "dark";
      sp.tokens.shadow = {
        color: {
          $type: "color",
          $value: { colorSpace: "oklch", components: [0.02, 0, 0], alpha: 1 },
        },
        "level-1": {
          $type: "shadow",
          $value: [{ offsetX: px(0), offsetY: px(4), blur: px(12), spread: px(0) }],
        },
      };
      return sp;
    })(),
    tree: base.tree,
  },
  "CF-07": {
    spec: (() => {
      const sp = clone(base.spec);
      sp.tokens.gradient = {
        hero: {
          $type: "gradient",
          $value: [
            { color: { colorSpace: "oklch", components: [0.55, 0.2, 290], alpha: 1 }, position: 0 },
            { color: { colorSpace: "oklch", components: [0.6, 0.15, 230], alpha: 1 }, position: 1 },
          ],
        },
      };
      return sp;
    })(),
    tree: base.tree,
  },
  "CF-08": {
    spec: withL2(base.spec, {
      "media.treatment": "duotone",
      "color.palette_id": vividPal?.id ?? "",
    }),
    tree: base.tree,
  },
  "CF-09": {
    spec: { ...clone(base.spec), decor: { max: 3, effects: ["grain", "rule-lines", "glass"] } },
    tree: base.tree,
  },
  "CF-10": {
    spec: { ...withL2(base.spec, { "depth.style": "brutal-offset" }), theme: "dark" },
    tree: base.tree,
  },
  "CF-11": {
    spec: {
      ...withL2(base.spec, { "motion.level": "none" }),
      signature: { id: "SIG-06", intensity: 1, apply_to: [] },
    },
    tree: base.tree,
  },
  "CF-12": {
    spec: clone(base.spec),
    tree: {
      sections: [
        {
          id: "hero",
          block: "hero",
          variant: "hero.centered",
          bg: "bg",
          pad: 1,
          slots: { eyebrow: { copy: { text: "✨ New", placeholder: false } } },
        },
      ],
    },
  },
};

rmSync(OUT, { recursive: true, force: true });
let n = 0;
for (const [id, list] of Object.entries(fx)) {
  mkdirSync(join(OUT, id), { recursive: true });
  list.forEach((input, i) => {
    const expect = i < 2 ? "pass" : "fail";
    const file = `${expect}-${(i % 2) + 1}.json`;
    writeFileSync(join(OUT, id, file), `${JSON.stringify({ id, expect, input }, null, 2)}\n`);
    n++;
  });
}
for (const [cf, v] of Object.entries(conflicts)) {
  mkdirSync(join(OUT, "conflicts", cf), { recursive: true });
  writeFileSync(
    join(OUT, "conflicts", cf, "fail-1.json"),
    `${JSON.stringify({ cf, ...v }, null, 2)}\n`,
  );
  n++;
}
process.stdout.write(`scoring fixtures: ${n}개\n`);
