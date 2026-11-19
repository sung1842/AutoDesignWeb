// pnpm data:validate (09장 9.2.3 교차 참조 검사, 9.4.3 ①②, AC-03-01·AC-05-03)
//   봉투·키 스키마(zod) → 중복 id·temp 접두사 → 교차 참조(고아 0) → 수량(9.2.2) → 파일 sha256 → CSV 열.
//   종료 코드: 0 = 전부 유효, 1 = 오류 1건 이상(오류마다 묶음 이름·경로 출력).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  AXIS_KEYS,
  BUNDLES,
  CANDIDATE_CSV_COLUMNS,
  TMP_PREFIX,
  envelope,
  envelopeMeta,
  type BundleDef,
} from "../../packages/data-contracts/src/index.js";
import { bundleFiles, bundleItems, loadFile, walk, type Obj } from "./load.js";

export interface Issue {
  bundle: string;
  path: string;
  message: string;
}

/** 9.2.2 수량(P0). 03장·02장 정의와 같다. */
export const COUNTS: Record<string, number> = {
  B1: 5,
  B2: 8,
  B3: 8,
  B4: 3,
  B7: 20,
  B10: 48,
  B11: 120,
  B13: 60,
  B16: 32,
};
export const FONT_COUNTS = { hangul: 12, latin: 14 } as const;

const label = (d: BundleDef): string => `${d.id} ${d.name}`;
const byId = (id: string): BundleDef => {
  const d = BUNDLES.find((b) => b.id === id);
  if (!d) throw new Error(`레지스트리에 ${id} 없음`);
  return d;
};

function checkSchema(root: string, def: BundleDef, out: Issue[]): void {
  const files = bundleFiles(root, def);
  if (files.length === 0) {
    if (!def.optional)
      out.push({ bundle: label(def), path: def.paths.join(","), message: "파일 없음" });
    return;
  }
  if (def.layout !== "envelopeDir" && def.layout !== "itemDir")
    for (const p of def.paths)
      if (!existsSync(join(root, p)))
        out.push({ bundle: label(def), path: p, message: "파일 없음" });
  for (const f of files) {
    const lf = loadFile(root, f);
    if (lf.error) {
      out.push({ bundle: label(def), path: f, message: lf.error });
      continue;
    }
    if (def.layout === "text") {
      if (!/^# /m.test(lf.text ?? ""))
        out.push({ bundle: label(def), path: f, message: "제목(# ) 없음" });
      continue;
    }
    if (def.layout === "yaml") {
      try {
        if (parseYaml(lf.text ?? "") == null)
          out.push({ bundle: label(def), path: f, message: "빈 YAML" });
      } catch (e) {
        out.push({
          bundle: label(def),
          path: f,
          message: `YAML 파싱 실패: ${(e as Error).message}`,
        });
      }
      continue;
    }
    const schema =
      def.layout === "itemDir"
        ? def.item
        : def.item
          ? envelope(def.item)
          : envelopeMeta.passthrough();
    if (!schema) continue;
    const r = schema.safeParse(lf.json);
    if (!r.success)
      for (const iss of r.error.issues.slice(0, 5))
        out.push({
          bundle: label(def),
          path: f,
          message: `스키마: ${iss.path.join(".") || "(루트)"} ${iss.message}`,
        });
    const j = lf.json as Obj;
    if (def.layout !== "itemDir" && j && typeof j === "object" && j.bundle !== def.name)
      out.push({
        bundle: label(def),
        path: f,
        message: `bundle 값 ${String(j.bundle)} ≠ ${def.name}`,
      });
    if (def.layout === "envelopeDir" && Array.isArray(j?.items) && j.items.length !== 1)
      out.push({ bundle: label(def), path: f, message: "파일당 항목 1개" });
  }
}

function checkIds(root: string, def: BundleDef, out: Issue[]): void {
  const seen = new Set<string>();
  for (const f of bundleFiles(root, def)) {
    const lf = loadFile(root, f);
    const j = lf.json as Obj | undefined;
    const temp = j && typeof j === "object" && j.provenance === "temp";
    const items =
      def.layout === "itemDir" ? (j ? [j] : []) : Array.isArray(j?.items) ? (j.items as Obj[]) : [];
    for (const it of items) {
      if (typeof it?.id !== "string") continue;
      if (seen.has(it.id)) out.push({ bundle: label(def), path: f, message: `중복 id ${it.id}` });
      seen.add(it.id);
      if (temp && def.freeIds && !it.id.startsWith(TMP_PREFIX))
        out.push({ bundle: label(def), path: f, message: `temp id ${it.id}에 ${TMP_PREFIX} 없음` });
    }
  }
}

function checkCrossRefs(root: string, out: Issue[]): void {
  const items = (id: string): Obj[] => bundleItems(root, byId(id));
  const ref = (bundle: string, what: string, id: unknown, pool: Set<string>): void => {
    if (typeof id !== "string" || !pool.has(id))
      out.push({ bundle, path: "(교차 참조)", message: `${what} → 없는 id ${String(id)}` });
  };
  const types = items("B2");
  const presets = items("B3");
  const presetIds = new Set(presets.map((p) => String(p.id)));
  const typeIds = new Set(types.map((t) => String(t.id)));
  for (const t of types) {
    ref("B2 types", `${String(t.id)}.anchorPresetId`, t.anchorPresetId, presetIds);
    const anchor = presets.find((p) => p.id === t.anchorPresetId);
    if (anchor && anchor.typeId !== t.id)
      out.push({
        bundle: "B2 types",
        path: "(교차 참조)",
        message: `${String(t.id)} 앵커의 typeId ≠ 유형`,
      });
    if (anchor && JSON.stringify(anchor.l1) !== JSON.stringify(t.centroid))
      out.push({
        bundle: "B2 types",
        path: "(교차 참조)",
        message: `${String(t.id)}.centroid ≠ 앵커 프리셋 l1(02장 2.11.1)`,
      });
  }
  for (const p of presets) ref("B3 presets", `${String(p.id)}.typeId`, p.typeId, typeIds);

  const fonts = items("B6");
  const fontScript = new Map(fonts.map((f) => [String(f.id), f.script]));
  const fontIds = new Set(fontScript.keys());
  const pairings = items("B7");
  const pairingIds = new Set(pairings.map((p) => String(p.id)));
  for (const p of pairings) {
    for (const k of ["headingFontId", "bodyFontId", "labelFontId"] as const)
      if (k !== "labelFontId" || p[k] !== undefined)
        ref("B7 pairings", `${String(p.id)}.${k}`, p[k], fontIds);
    if (
      ![fontScript.get(String(p.headingFontId)), fontScript.get(String(p.bodyFontId))].includes(
        "hangul",
      )
    )
      out.push({
        bundle: "B7 pairings",
        path: "(교차 참조)",
        message: `${String(p.id)}: 한글 서체 없음(D-27)`,
      });
  }
  for (const p of presets)
    for (const k of ["pairingId", "pairing_id"])
      if (p[k] !== undefined)
        ref("B3 presets", `${String(p.id)}.${k} (pairings)`, p[k], pairingIds);
  // 프리셋 l2·허용 집합의 페어링 장 ID(FP01~)는 B7 `code`로 찾는다(ASM-013).
  const pairingCodes = new Map(pairings.map((p) => [String(p.code ?? p.id), p]));
  for (const p of presets) {
    const l2 = (p.l2 ?? {}) as Obj;
    const allowed = ((p.allowed ?? {}) as Obj)["type.pairing_id"];
    const codes = [l2["type.pairing_id"], ...(Array.isArray(allowed) ? allowed : [])];
    for (const c of codes) {
      ref(
        "B3 presets",
        `${String(p.id)}.type.pairing_id (pairings code)`,
        c,
        new Set(pairingCodes.keys()),
      );
      const pr = pairingCodes.get(String(c));
      const types = pr?.allowedTypes;
      if (pr && Array.isArray(types) && !types.includes(String(p.typeId)))
        out.push({
          bundle: "B3 presets",
          path: "(교차 참조)",
          message: `${String(p.id)}: pairings ${String(c)}의 허용 유형에 ${String(p.typeId)} 없음`,
        });
    }
  }

  const cards = items("B10");
  for (const c of cards) ref("B10 card-plan", `${String(c.id)}.presetId`, c.presetId, presetIds);
  const abs = items("B11");
  for (const a of abs)
    ref("B11 ab-plan", `${String(a.id)}.basePresetId`, a.basePresetId, presetIds);
  const assetIds = new Set([...cards, ...abs].map((x) => String(x.id)));
  for (const a of items("B12")) ref("B12 approvals", "assetId", a.assetId, assetIds);

  const images = items("B8");
  const imageIds = new Set(images.map((i) => String(i.id)));
  for (const tpl of items("B9").flatMap((s) =>
    Array.isArray(s.templates) ? (s.templates as Obj[]) : [],
  ))
    for (const iid of Array.isArray(tpl.imageIds) ? tpl.imageIds : [])
      ref("B9 survey-templates", `${String(tpl.id)}.imageIds`, iid, imageIds);
  for (const img of images) {
    const p = join(root, String(img.path));
    if (img.source !== "placeholder" || existsSync(p)) {
      if (!existsSync(p)) {
        out.push({ bundle: "B8 images", path: String(img.path), message: "파일 없음" });
        continue;
      }
      const h = createHash("sha256").update(readFileSync(p)).digest("hex");
      if (h !== img.sha256)
        out.push({ bundle: "B8 images", path: String(img.path), message: "sha256 불일치" });
    }
  }

  const axes = items("B1");
  const keys = axes.map((a) => a.key).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...AXIS_KEYS].sort()))
    out.push({ bundle: "B1 axes", path: "(교차 참조)", message: "축 key가 R-01 키 5개와 다름" });

  // T-34: B24 태그 ⊆ 03장 3.10.2 ImageTag(이미지 팩 태그 중 tone.·orient. 제외)
  const imageTags = new Set(
    images
      .flatMap((i) => (Array.isArray(i.tags) ? (i.tags as unknown[]).map(String) : []))
      .filter((t) => !/^(tone|orient)\./.test(t)),
  );
  for (const k of items("B24"))
    for (const t of Array.isArray(k.tags) ? k.tags : [k.tags])
      ref("B24 image-tag-keywords", `${String(k.id)}.tags`, t, imageTags);
  // 03장 3.6.5: defaultImageTag는 이미지 팩 태그여야 한다
  for (const p of items("B4"))
    ref("B4 purposes", `${String(p.id)}.defaultImageTag`, p.defaultImageTag, imageTags);
}

function checkCounts(root: string, out: Issue[]): void {
  for (const [id, n] of Object.entries(COUNTS)) {
    const def = byId(id);
    const got = bundleItems(root, def).length;
    if (got !== n)
      out.push({ bundle: label(def), path: def.paths.join(","), message: `수량 ${got} ≠ ${n}` });
  }
  // 9.2.2 하한: B21 ≥80, B22 범주 6 × 키워드 ≥10, B20 축 힌트 2방향 × 5축
  const brands = bundleItems(root, byId("B21")).length;
  if (brands < 80)
    out.push({
      bundle: "B21 high-risk-brands",
      path: "config/high_risk_brands.json",
      message: `수량 ${brands} < 80`,
    });
  const cats = bundleItems(root, byId("B22"));
  if (cats.length !== 6 || cats.some((c) => !Array.isArray(c.keywords) || c.keywords.length < 10))
    out.push({
      bundle: "B22 prohibited-categories",
      path: "config/prohibited_categories.json",
      message: "범주 6 × 키워드 ≥10 아님",
    });
  const hints = bundleItems(root, byId("B20")).filter((h) => typeof h.axis === "string");
  if (hints.length !== AXIS_KEYS.length * 2)
    out.push({
      bundle: "B20 copy-templates",
      path: "config/axis_hints.json",
      message: `축 힌트 ${hints.length} ≠ 10`,
    });
  const fonts = bundleItems(root, byId("B6"));
  for (const [script, n] of Object.entries(FONT_COUNTS)) {
    const got = fonts.filter((f) => f.script === script).length;
    if (got !== n)
      out.push({
        bundle: "B6 fonts",
        path: "data/fonts/registry.json",
        message: `${script} ${got} ≠ ${n}`,
      });
  }
}

/** AC-05-03: 후보·관측 CSV 열은 05장 목록만(플랫폼 설명·평점·이미지 금지). */
function checkCsv(root: string, out: Issue[]): void {
  const files = [
    ...walk(root, "data/seed/candidates.csv"),
    ...walk(root, "data/observations"),
  ].filter((f) => f.endsWith(".csv"));
  const allowed = new Set<string>(CANDIDATE_CSV_COLUMNS);
  for (const f of files) {
    const header = (readFileSync(join(root, f), "utf8").split(/\r?\n/)[0] ?? "")
      .split(",")
      .map((c) => c.trim());
    const extra = header.filter((c) => !allowed.has(c));
    const missing = CANDIDATE_CSV_COLUMNS.filter((c) => !header.includes(c));
    if (extra.length)
      out.push({ bundle: "csv", path: f, message: `허용 밖 열: ${extra.join(", ")}` });
    if (missing.length)
      out.push({ bundle: "csv", path: f, message: `빠진 열: ${missing.join(", ")}` });
  }
}

export function validate(root: string): Issue[] {
  const out: Issue[] = [];
  for (const def of BUNDLES) {
    checkSchema(root, def, out);
    checkIds(root, def, out);
  }
  checkCrossRefs(root, out);
  checkCounts(root, out);
  checkCsv(root, out);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const issues = validate(process.cwd());
  for (const i of issues) process.stdout.write(`FAIL ${i.bundle} ${i.path}: ${i.message}\n`);
  process.stdout.write(
    issues.length === 0
      ? `data:validate: ${BUNDLES.length}개 묶음 유효, 교차 참조 고아 0\n`
      : `data:validate: 오류 ${issues.length}건\n`,
  );
  process.exitCode = issues.length === 0 ? 0 : 1;
}
