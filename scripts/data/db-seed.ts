// pnpm db:seed (09장 9.4.3 ⑥, 06장 6.16 "택소노미·차단 목록은 db:seed로만"): data/·config → DB 복제본. 멱등(upsert).
//   대상: taxonomy_releases·types·presets(B2·B3), sources·reference_sites·reference_labels(B13),
//         normalizers(B18), blocked_brands(B21). 쓰기는 DbPort.withService만(6.3.5).
//   temp B13에는 사람 라벨이 없어 primary 라벨을 데이터에서 유도한다(ASM-022).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { withDotenv } from "../../packages/config/src/dotenv.js";
import { type Tx, createDbPort, q } from "../../packages/db/src/index.js";
import { AXIS_KEYS } from "../../packages/data-contracts/src/index.js";
import type { Obj } from "./load.js";

const readJson = (root: string, rel: string): Obj =>
  JSON.parse(readFileSync(join(root, rel), "utf8")) as Obj;
const itemsOf = (j: Obj): Obj[] => (Array.isArray(j.items) ? (j.items as Obj[]) : [j]);
const l1Obj = (v: unknown): Record<string, number> =>
  Object.fromEntries(AXIS_KEYS.map((k, i) => [k, (v as number[])[i] ?? 0]));

/** 시즌 YYYY-SN의 공개일 = 분기 첫 월요일(06장 taxonomy_releases), 동결일 = −14일. */
export function releaseDate(version: string): string {
  const m = /^(\d{4})-S([1-4])/.exec(version);
  if (!m) throw new Error(`시즌 형식 아님: ${version}`);
  const d = new Date(Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function checksum(root: string, files: string[]): string {
  const h = createHash("sha256");
  for (const f of files) h.update(f).update(readFileSync(join(root, f)));
  return `sha256:${h.digest("hex")}`;
}

/** temp 레퍼런스의 L1(0~1) → 라벨 척도 1..5(05장 5.3.6). */
const toScale = (x: number): number => Math.min(5, Math.max(1, Math.round(1 + 4 * x)));

export async function dbSeed(root: string, url: string): Promise<Record<string, number>> {
  const typesJ = readJson(root, "data/taxonomy/types.json");
  const version = String(typesJ.taxonomyVersion);
  const types = itemsOf(typesJ);
  const presetFiles = readdirSync(join(root, "data/taxonomy/presets"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => `data/taxonomy/presets/${f}`);
  const presets = presetFiles.flatMap((f) => itemsOf(readJson(root, f)));
  const refsJ = readJson(root, "data/references/seed.json");
  const refs = itemsOf(refsJ);
  const normDir = "data/normalizers";
  const normalizers = readdirSync(join(root, normDir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(root, `${normDir}/${f}`));
  const brands = itemsOf(readJson(root, "config/high_risk_brands.json"));
  const sum = checksum(root, ["data/taxonomy/types.json", ...presetFiles]);
  const rel = releaseDate(version);
  const anchorL2 = new Map(presets.map((p) => [String(p.typeId), p.l2]));

  const db = createDbPort(url);
  try {
    return await db.withService(async (tx: Tx) => {
      const n: Record<string, number> = {};
      await q(
        tx,
        `insert into taxonomy_releases (version, status, data_checksum, release_date, freeze_date, activated_at)
         values ($1, 'active', $2, $3::date, $3::date - 14, now())
         on conflict (version) do update set data_checksum = excluded.data_checksum`,
        [version, sum, rel],
      );
      for (const t of types)
        await q(
          tx,
          `insert into types (taxonomy_version, id, slug, name_ko, description_ko, centroid, anchor_preset_id)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (taxonomy_version, id) do update set slug = excluded.slug, name_ko = excluded.name_ko,
             description_ko = excluded.description_ko, centroid = excluded.centroid, anchor_preset_id = excluded.anchor_preset_id`,
          [
            version,
            t.id,
            t.slug,
            t.nameKo,
            t.descriptionKo,
            JSON.stringify(l1Obj(t.centroid)),
            t.anchorPresetId,
          ],
        );
      n.types = types.length;
      for (const p of presets)
        await q(
          tx,
          `insert into presets (taxonomy_version, id, type_id, tokens, l2, theme, status, provenance)
           values ($1,$2,$3,$4,$5,$6,'approved',$7)
           on conflict (taxonomy_version, id) do update set type_id = excluded.type_id, tokens = excluded.tokens,
             l2 = excluded.l2, theme = excluded.theme, provenance = excluded.provenance`,
          [
            version,
            p.id,
            p.typeId,
            JSON.stringify(p.tokens ?? {}),
            JSON.stringify(p.l2 ?? {}),
            p.theme,
            JSON.stringify(p.provenance ?? {}),
          ],
        );
      n.presets = presets.length;

      const temp = refsJ.provenance === "temp";
      await q(
        tx,
        `insert into sources (source_id, kind, name, tier, url_pattern, access_method, status, note)
         values ('direct', 'origin_site', '수동 큐레이션(직접 방문)', 'T1', 'https://*', 'manual', 'manual_only', $1)
         on conflict (source_id) do nothing`,
        [temp ? "seed:temp" : null],
      );
      for (const r of refs) {
        const id = String(
          (
            await q(
              tx,
              `insert into reference_sites (url, domain, title, title_ko, type_primary, source_id, tier, use, lang, era, status, role, flags)
               values ($1,$2,$3,$4,$5,'direct',$6,$7,'ko','current','active','seed',$8)
               on conflict (domain) do update set url = excluded.url, title = excluded.title, title_ko = excluded.title_ko,
                 type_primary = excluded.type_primary, tier = excluded.tier, use = excluded.use, flags = excluded.flags
               returning id`,
              [
                r.url,
                r.domain,
                r.titleKo,
                String(r.titleKo).slice(0, 40),
                r.typeId,
                r.tier,
                r.purpose,
                temp ? ["temp"] : [],
              ],
            )
          ).rows[0]?.id,
        );
        if (!temp) continue; // human B13: 라벨은 라벨 도구(05장 5.7)에서만
        const axes = Object.fromEntries(
          AXIS_KEYS.map((k, i) => [k, toScale((r.l1 as number[])[i] ?? 0.5)]),
        );
        const checklist = { "S-04": "temp", "S-05": "temp", "S-08": "temp", "S-10": "temp" };
        await q(
          tx,
          "delete from reference_labels where reference_id = $1 and rater_id = 'op' and purpose = 'primary'",
          [id],
        );
        await q(
          tx,
          `insert into reference_labels (reference_id, rater_id, session_id, purpose, axes, l2, type_primary, checklist)
           values ($1, 'op', 'seed:temp', 'primary', $2, $3, $4, $5)`,
          [
            id,
            JSON.stringify(axes),
            JSON.stringify(anchorL2.get(String(r.typeId)) ?? {}),
            r.typeId,
            JSON.stringify(checklist),
          ],
        );
      }
      n.reference_sites = refs.length;

      for (const b of normalizers) {
        const corpus = (b.corpus ?? {}) as Obj;
        await q(
          tx,
          `insert into normalizers (version, status, body, corpus_hash)
           values ($1, 'draft', $2, $3)
           on conflict (version) do update set body = excluded.body, corpus_hash = excluded.corpus_hash
           where normalizers.status = 'draft'`,
          [b.version, JSON.stringify(b), String(corpus.hash ?? "none")],
        );
      }
      n.normalizers = normalizers.length;

      for (const b of brands)
        await q(
          tx,
          `insert into blocked_brands (id, canonical, aliases, category, domains)
           values ($1,$2,$3,$4,$5)
           on conflict (id) do update set canonical = excluded.canonical, aliases = excluded.aliases,
             category = excluded.category, domains = excluded.domains`,
          [b.id, b.canonical, b.aliases, b.category, b.domains],
        );
      n.blocked_brands = brands.length;
      return n;
    });
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const env = withDotenv(root);
  const url = env.DATABASE_URL_DIRECT;
  if (!url) {
    process.stderr.write("db:seed: DATABASE_URL_DIRECT 없음(.env.local 또는 환경 변수)\n");
    process.exit(1);
  }
  dbSeed(root, url).then(
    (n) =>
      process.stdout.write(
        `db:seed: ${Object.entries(n)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}\n`,
      ),
    (e: unknown) => {
      process.stderr.write(`db:seed 실패: ${(e as Error).message}\n`);
      process.exit(1);
    },
  );
}
