// M4 수용 테스트(3/7): survey:build 산출·멱등·x_card·--check(09장 9.4.6 ①②③,
// AC-02-07·08·09·10·37(빌드 쪽), AC-05-23). CLI·manifest 계약은 ASSUMPTIONS ASM-093.
// 전수 산출물 검사는 커밋된 data/survey/manifest.lock.json(전체 survey:build 산출)으로 하고,
// 실제 렌더·업로드·DB 멱등은 --only 소수 ID를 임시 저장소·임시 manifest로 다시 돌려 확인한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getThresholds } from "../../../packages/config/src/index.js";
import { createDbPort, q, type DbPort } from "../../../packages/db/src/index.js";
import { ROOT, run } from "../_support/sh.js";

type Vec = number[];
interface Asset {
  path: string;
  sha256: string;
  w: number;
  h: number;
  bytes: number;
}
interface ManItem {
  assetId: string;
  kind: "card" | "ab_image" | "ab_pair" | "anchor_ref";
  status: "draft" | "verified" | "active" | "retired";
  target: Vec | null;
  x: Vec | null;
  inputHash: string;
  domHash: string | null;
  assets: { desktop: Asset; mobile?: Asset } | null;
  altText: string | null;
  dominantColors: string[] | null;
  focusRegion: { x: number; y: number; w: number; h: number } | null;
  reasons: string[];
}
interface Manifest {
  bundle: string;
  taxonomyVersion: string;
  normalizerVersion: string;
  extractorVersion: string;
  items: ManItem[];
}
interface Report {
  rendered: number;
  uploaded: number;
  dbChanged: number;
  skipped: number;
}

const DB_URL = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_m4survey";
const ENV = { DATABASE_URL_DIRECT: DB_URL, DATABASE_URL_POOLED: DB_URL, STACK_PROFILE: "native" };
const MAN_PATH = join(ROOT, "data/survey/manifest.lock.json");
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
const manifest = (): Manifest => JSON.parse(readFileSync(MAN_PATH, "utf8")) as Manifest;
const AXES = ["A1", "A2", "A3", "A4", "A5"] as const;
const TH = getThresholds() as unknown as {
  diagnosis: { surveyAssetL1AbsMax: number };
  perf: { cardImageDesktopKbMax: number; cardImageMobileKbMax: number };
};
const KB = 1024;
/** 02장 2.4.5·06장 DDL 규격(R-07). 용량 상한은 thresholds perf. */
const SPEC = {
  desktop: { w: 1280, h: 800, maxBytes: TH.perf.cardImageDesktopKbMax * KB },
  mobile: { w: 780, h: 1560, maxBytes: TH.perf.cardImageMobileKbMax * KB },
} as const;
/** 2.4.4 축별 focus_region. */
const FOCUS: Record<string, [number, number, number, number]> = {
  A1: [0, 0.08, 1, 0.62],
  A2: [0, 0, 1, 1],
  A3: [0, 0.45, 1, 0.55],
  A4: [0, 0, 1, 1],
  A5: [0, 0.55, 1, 0.45],
};

const cards = read<{ items: { id: string; svId: string; templateId: string; targetL1: Vec }[] }>(
  "data/survey/card_plan.json",
).items;
const ab = read<{
  items: { id: string; axis: string; levelA: number; levelB: number; images: { id: string }[] }[];
}>("data/survey/ab_plan.json").items;
const typeNames = read<{ items: { id: string; nameKo?: string; name?: string }[] }>(
  "data/taxonomy/types.json",
).items.flatMap((t) => [t.nameKo, t.name].filter((s): s is string => !!s));

/** WebP 헤더(VP8 / VP8L / VP8X)에서 폭·높이를 읽는다. */
function webpSize(b: Buffer): { w: number; h: number } {
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP")
    throw new Error("WebP 아님");
  const fourcc = b.toString("ascii", 12, 16);
  if (fourcc === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (fourcc === "VP8L") {
    const v = b.readUInt32LE(21);
    return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`알 수 없는 청크 ${fourcc}`);
}

describe("9.4.6 ① · AC-05-23 manifest 수량·활성 기준", () => {
  it("manifest가 있고 카드 48·A/B 이미지 120·쌍 120·앵커 참조 25", () => {
    expect(existsSync(MAN_PATH), "pnpm survey:build 먼저(data/survey/manifest.lock.json)").toBe(
      true,
    );
    const m = manifest();
    expect(m.bundle).toBe("survey-manifest");
    const n = (k: ManItem["kind"]) => m.items.filter((i) => i.kind === k).length;
    expect([n("card"), n("ab_image"), n("ab_pair"), n("anchor_ref")]).toEqual([48, 120, 120, 25]);
    const ids = m.items.map((i) => i.assetId);
    expect(ids).toEqual([...ids].sort());
    expect(m.normalizerVersion).toMatch(/\S/);
  });
  it("활성 카드 = 48장 전부(approved 전부 활성)", () => {
    const m = manifest();
    const active = m.items.filter((i) => i.kind === "card" && i.status === "active");
    expect(
      active.length,
      m.items
        .filter((i) => i.kind === "card" && i.status !== "active")
        .map((i) => `${i.assetId}:${i.reasons.join("/")}`)
        .join(", "),
    ).toBe(48);
  });
  it("활성 카드는 모두 x_card를 갖고 모든 축 |x − target| ≤ surveyAssetL1AbsMax(5.9)", () => {
    const m = manifest();
    const act = m.items.filter((i) => i.kind === "card" && i.status === "active");
    for (const c of act) {
      expect(c.x?.length, c.assetId).toBe(AXES.length);
      expect(c.target?.length, c.assetId).toBe(AXES.length);
      AXES.forEach((a, k) =>
        expect(Math.abs(c.x![k]! - c.target![k]!), `${c.assetId} ${a}`).toBeLessThanOrEqual(
          TH.diagnosis.surveyAssetL1AbsMax,
        ),
      );
    }
  });
  it("커밋된 manifest로 survey:build --check 종료 코드 0(커버리지·문항 후보·카드×축 95% ≤ 0.10·대체 텍스트 길이, BLK-021)", async () => {
    const r = await run("pnpm", ["-s", "survey:build", "--check"], ROOT);
    expect(r.code, r.out.slice(-2000)).toBe(0);
  });
  it("A/B 수준은 {0.2, 0.5, 0.8}이고 축별 활성 쌍 ≥ 19", () => {
    const m = manifest();
    const st = new Map(m.items.map((i) => [i.assetId, i.status]));
    const per: Record<string, number> = {};
    for (const p of ab) {
      expect([0.2, 0.5, 0.8]).toContain(p.levelA);
      expect([0.2, 0.5, 0.8]).toContain(p.levelB);
      if (st.get(p.id) === "active") per[p.axis] = (per[p.axis] ?? 0) + 1;
      // 쌍이 활성이면 두 이미지도 활성
      if (st.get(p.id) === "active")
        for (const i of p.images) expect(st.get(i.id), `${p.id}/${i.id}`).toBe("active");
    }
    for (const a of AXES) expect(per[a] ?? 0, `축 ${a} 활성 쌍`).toBeGreaterThanOrEqual(19);
  });
  it("9.4.6 ③ 카드·A/B 이미지의 x는 실측(target과 같은 배열 복사가 아님)", () => {
    const m = manifest();
    const measured = m.items.filter((i) => (i.kind === "card" || i.kind === "ab_image") && i.x);
    expect(measured.length).toBeGreaterThan(0);
    const same = measured.filter((i) => JSON.stringify(i.x) === JSON.stringify(i.target));
    expect(same.length).toBeLessThan(measured.length);
  });
});

describe("AC-02-10 · AC-02-08 · 2.3.6 자산 메타", () => {
  it("모든 자산 규격 1280×800 ≤140KB / 780×1560 ≤160KB, 앵커 참조는 desktop만", () => {
    for (const i of manifest().items) {
      if (i.kind === "ab_pair") {
        expect(i.assets, i.assetId).toBeNull();
        continue;
      }
      const a = i.assets!;
      expect([a.desktop.w, a.desktop.h], i.assetId).toEqual([SPEC.desktop.w, SPEC.desktop.h]);
      expect(a.desktop.bytes, i.assetId).toBeLessThanOrEqual(SPEC.desktop.maxBytes);
      expect(a.desktop.sha256).toMatch(/^[0-9a-f]{64}$/);
      if (i.kind === "anchor_ref") expect(a.mobile, i.assetId).toBeUndefined();
      else {
        expect([a.mobile!.w, a.mobile!.h], i.assetId).toEqual([SPEC.mobile.w, SPEC.mobile.h]);
        expect(a.mobile!.bytes, i.assetId).toBeLessThanOrEqual(SPEC.mobile.maxBytes);
      }
    }
  });
  it("AC-02-08 경로는 survey-assets 버킷 `<tv>/{id}.{device}.{sha12}.webp`, 레퍼런스 스크린샷 0", () => {
    const m = manifest();
    for (const i of m.items) {
      if (!i.assets) continue;
      for (const [dev, a] of Object.entries(i.assets)) {
        expect(a.path, i.assetId).toBe(
          `survey-assets/${m.taxonomyVersion}/${i.assetId}.${dev}.${a.sha256.slice(0, 12)}.webp`,
        );
        expect(a.path).not.toMatch(/ref-screenshots/);
      }
    }
  });
  it("대체 텍스트 있음·유형명 없음(길이 5~160은 --check, BLK-021), dominant_colors 대문자 HEX 3, focus_region(카드 전체·A/B 축별)", () => {
    const m = manifest();
    const axisOf = new Map(ab.flatMap((p) => p.images.map((i) => [i.id, p.axis] as const)));
    for (const i of m.items) {
      if (i.kind === "ab_pair") continue;
      expect(i.altText, i.assetId).toMatch(/^선택지 \{n\}: \S/);
      for (const t of typeNames) expect(i.altText, i.assetId).not.toContain(t);
      expect(i.dominantColors, i.assetId).toHaveLength(3);
      for (const c of i.dominantColors!) expect(c).toMatch(/^#[0-9A-F]{6}$/);
      const f = i.focusRegion!;
      const want = i.kind === "ab_image" ? FOCUS[axisOf.get(i.assetId)!]! : [0, 0, 1, 1];
      expect([f.x, f.y, f.w, f.h], i.assetId).toEqual(want);
    }
  });
  it("AC-02-09 같은 문항의 이미지는 DOM 텍스트·이미지 src 집합이 같다(템플릿별 카드, 쌍의 두 이미지)", () => {
    const m = manifest();
    const dom = new Map(m.items.map((i) => [i.assetId, i.domHash]));
    for (const tpl of ["tpl-hero", "tpl-grid", "tpl-text"]) {
      const hs = new Set(cards.filter((c) => c.templateId === tpl).map((c) => dom.get(c.id)));
      expect(hs.size, tpl).toBe(1);
      expect([...hs][0]).toMatch(/^[0-9a-f]{64}$/);
    }
    for (const p of ab) expect(dom.get(p.images[0]!.id), p.id).toBe(dom.get(p.images[1]!.id));
  });
});

describe("9.4.6 ② 렌더 결정성·멱등(--only, 임시 저장소·DB)", () => {
  const ONLY = ["C-SV01-hero", "ABP-T1-A1-2050"];
  const dir = mkdtempSync(join(tmpdir(), "tf-survey-build-"));
  const store = join(dir, "storage");
  const man = join(dir, "manifest.json");
  const args = (rep: string) => [
    "-s",
    "survey:build",
    "--only",
    ONLY.join(","),
    "--storage-root",
    store,
    "--manifest",
    man,
    "--report",
    join(dir, rep),
  ];
  let db: DbPort;
  const reports: Report[] = [];
  beforeAll(async () => {
    const up = await run("pnpm", ["-s", "db:native", "up"], ROOT);
    expect(up.code, up.out).toBe(0);
    const r = await run("pnpm", ["-s", "db:reset"], ROOT, ENV);
    expect(r.code, r.out).toBe(0);
    const s = await run("pnpm", ["-s", "db:seed"], ROOT, ENV);
    expect(s.code, s.out).toBe(0);
    db = createDbPort(DB_URL);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("1회차: 렌더·업로드 ≥ 1, survey_items에 행이 생긴다", async () => {
    const r = await run("pnpm", args("r1.json"), ROOT, ENV);
    expect(r.code, r.out.slice(-2000)).toBe(0);
    const rep = JSON.parse(readFileSync(join(dir, "r1.json"), "utf8")) as Report;
    reports.push(rep);
    expect(rep.uploaded).toBeGreaterThanOrEqual(1);
    expect(rep.dbChanged).toBeGreaterThanOrEqual(1);
    const rows = await db.withService((tx) =>
      q(tx, "select id from survey_items where id = any($1)", [
        ["C-SV01-hero", "AB-T1-A1-20", "AB-T1-A1-50", "ABP-T1-A1-2050"],
      ]),
    );
    expect(rows.rowCount).toBe(4);
  });
  it("2회차: 업로드 0건, DB 변경 0행", async () => {
    const r = await run("pnpm", args("r2.json"), ROOT, ENV);
    expect(r.code, r.out.slice(-2000)).toBe(0);
    const rep = JSON.parse(readFileSync(join(dir, "r2.json"), "utf8")) as Report;
    expect(rep.uploaded).toBe(0);
    expect(rep.dbChanged).toBe(0);
  });
  it("AC-02-10 실제 WebP 파일 규격·용량, sha256이 커밋된 manifest와 같다(렌더 결정성)", () => {
    const tmp = JSON.parse(readFileSync(man, "utf8")) as Manifest;
    const base = new Map(manifest().items.map((i) => [i.assetId, i]));
    for (const i of tmp.items) {
      if (!i.assets) continue;
      for (const [dev, a] of Object.entries(i.assets) as [keyof typeof SPEC, Asset][]) {
        const f = join(store, a.path);
        expect(existsSync(f), f).toBe(true);
        const b = readFileSync(f);
        expect(webpSize(b), `${i.assetId} ${dev}`).toEqual({ w: SPEC[dev].w, h: SPEC[dev].h });
        expect(b.length).toBe(a.bytes);
        expect(b.length).toBeLessThanOrEqual(SPEC[dev].maxBytes);
        expect(a.sha256, `${i.assetId} ${dev}`).toBe(base.get(i.assetId)?.assets?.[dev]?.sha256);
      }
      expect(i.x, i.assetId).toEqual(base.get(i.assetId)?.x);
    }
  });
});

describe("AC-02-07 · AC-02-37 survey:build --check(커버리지·문항 후보)", () => {
  const dir = mkdtempSync(join(tmpdir(), "tf-survey-check-"));
  /** 계획 target을 x로 둔 결정적 픽스처(실측과 무관). keep이 false인 카드는 draft. */
  const fixture = (name: string, keep: (c: (typeof cards)[number]) => boolean): string => {
    const items = [
      ...cards.map((c) => ({
        assetId: c.id,
        status: keep(c) ? "active" : "draft",
        x: c.targetL1,
      })),
    ];
    const p = join(dir, name);
    writeFileSync(p, JSON.stringify({ items }));
    return p;
  };
  it("카드 48장 전부 활성 픽스처는 종료 코드 0", async () => {
    const r = await run(
      "pnpm",
      ["-s", "survey:build", "--check", "--items", fixture("all.json", () => true)],
      ROOT,
    );
    expect(r.code, r.out.slice(-2000)).toBe(0);
  });
  it("tpl-grid 활성 3장만 남기면 종료 코드 1과 부족한 (템플릿, 문항 순번) 출력", async () => {
    const grid3 = new Set(["SV01", "SV02", "SV03"]);
    const p = fixture("grid3.json", (c) => c.templateId !== "tpl-grid" || grid3.has(c.svId));
    const r = await run("pnpm", ["-s", "survey:build", "--check", "--items", p], ROOT);
    expect(r.code).toBe(1);
    // template(seq) = [hero, grid, text][(seq-1) % 3] → grid = 2, 5, 8
    for (const seq of [2, 5, 8])
      expect(r.out).toMatch(new RegExp(`INSUFFICIENT stage=1 template=tpl-grid seq=${seq}\\b`));
    expect(r.out).not.toMatch(/template=tpl-hero/);
  });
  it("AC-02-07 커버리지 미달(템플릿별 active < 14)이면 종료 코드 1", async () => {
    const drop = new Set(["SV01", "SV02", "SV03"]);
    const p = fixture("cov.json", (c) => !(c.templateId === "tpl-text" && drop.has(c.svId)));
    const r = await run("pnpm", ["-s", "survey:build", "--check", "--items", p], ROOT);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/COVERAGE template=tpl-text active=13/);
  });
});
