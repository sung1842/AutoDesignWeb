// E2E 웹 서버(playwright.config webServer, ASM-100): 전용 DB(tastefit_e2e) 초기화·시드 → 설문 픽스처(전부 active,
// 자산 경로는 manifest.lock = survey:build 산출과 같은 파일) + 닮은 사이트 픽스처 → next build → next start.
// 비밀값은 실행마다 임의 생성(저장소에 쓰지 않음).
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDbPort, q } from "../packages/db/src/index.js";
import { seedSimilarSites, seedSurveyFixture } from "../packages/db/src/testing/fixtures.js";

const ROOT = join(import.meta.dirname, "..");
export const E2E_PORT = 3100;
const DB = "postgres://tastefit_app:tastefit_app@127.0.0.1:54322/tastefit_e2e";
const secret = (): string => randomBytes(32).toString("base64url");
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  APP_ENV: "local",
  STACK_PROFILE: "native",
  AUTH_DRIVER: "local",
  STORAGE_DRIVER: "fs",
  MAIL_DRIVER: "local",
  TURNSTILE_DRIVER: "local",
  LLM_MODE: "mock",
  WEB_ORIGIN: `http://localhost:${E2E_PORT}`,
  PREVIEW_ORIGIN: "http://127.0.0.1:3101",
  DATABASE_URL_DIRECT: DB,
  DATABASE_URL_POOLED: DB,
  LOCAL_JWT_SECRET: secret(),
  PREVIEW_SIGNING_SECRET: secret(),
  IP_HMAC_KEY: secret(),
  CONSENT_HASH_KEY: secret(),
  ADMIN_EMAILS: "admin@example.com",
  NEXT_TELEMETRY_DISABLED: "1",
};
const sh = (cmd: string, args: string[], cwd = ROOT): void => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 실패(${String(r.status)})`);
};

sh("pnpm", ["-s", "db:native", "up"]);
sh("pnpm", ["-s", "db:reset"]);
sh("pnpm", ["-s", "db:seed"]);
const db = createDbPort(DB);
await seedSurveyFixture(db);
await seedSimilarSites(db);
// 자산 경로를 survey:build 산출(manifest.lock)로 바꿔 실제 WebP를 쓴다(파일이 없으면 대체 텍스트 표시, 1.4.2 R1)
const man = join(ROOT, "data/survey/manifest.lock.json");
if (existsSync(man)) {
  const items = (
    JSON.parse(readFileSync(man, "utf8")) as { items: { assetId: string; assets: unknown }[] }
  ).items;
  await db.withService(async (tx) => {
    for (const i of items)
      if (i.assets)
        await q(tx, "update survey_items set assets = $2 where id = $1", [
          i.assetId,
          JSON.stringify(i.assets),
        ]);
  });
}
// 결과 화면 픽스처(AC-01-16·57): 유형 8종 + 안내 5종. 세션·결과 행을 직접 넣고 쿠키·ID를 파일로 넘긴다
const TYPES = (
  JSON.parse(readFileSync(join(ROOT, "data/taxonomy/types.json"), "utf8")) as {
    items: { id: string; centroid: number[] }[];
  }
).items;
const AXES = ["expression", "temperature", "shape", "density", "depth"];
const dist = (a: number[], b: number[]) =>
  Math.sqrt(a.reduce((x, v, i) => x + (v - (b[i] ?? 0)) ** 2, 0));
const fixtures: Record<
  string,
  { anonId: string; sessionId: string; typeId: string; notice: string | null }
> = {};
await db.withService(async (tx) => {
  const tv = String(
    (await q(tx, "select version from taxonomy_releases where status = 'active' limit 1")).rows[0]
      ?.version,
  );
  const cases: [string, string, string | null][] = [
    ...TYPES.map((t) => [`type-${t.id}`, t.id, null] as [string, string, null]),
    ["notice-low_signal", "T1", "low_signal"],
    ["notice-conflict", "T1", "conflict"],
    ["notice-low_consistency", "T1", "low_consistency"],
    ["notice-boundary", "T1", "boundary"],
    ["notice-null", "T1", null],
  ];
  for (const [key, typeId, notice] of cases) {
    const t = TYPES.find((x) => x.id === typeId)!;
    const order = [...TYPES]
      .sort((a, b) => dist(a.centroid, t.centroid) - dist(b.centroid, t.centroid))
      .map((x) => x.id);
    const anonId = randomUUID();
    const sid = String(
      (
        await q(
          tx,
          `insert into diagnosis_sessions (anon_id, taxonomy_version, seed, status, entry, versions, completed_at)
           values ($1, $2, 1, 'completed', 'direct', '{}', now()) returning id`,
          [anonId, tv],
        )
      ).rows[0]?.id,
    );
    const sites = (
      await q(tx, "select id from reference_sites where domain like $1 order by domain", [
        `fixture-${typeId.toLowerCase()}-%`,
      ])
    ).rows.map((r) => String(r.id));
    const profile = {
      typeId,
      secondTypeId: order[1],
      adjacentTypeIds: order.slice(1, 3),
      isBoundary: notice === "boundary",
      confidence: notice ? "low" : "high",
      flags: notice === "low_signal" ? ["low_signal"] : notice === "conflict" ? ["conflict"] : [],
      notice,
      kappa: 0.8,
      mu: t.centroid,
      var: t.centroid.map(() => 0.0025),
      axes: AXES.map((k, i) => ({
        key: k,
        mu: t.centroid[i],
        sigma: 0.05,
        sigmaDisplay: 0.065,
        state: "confirmed",
      })),
    };
    await q(
      tx,
      `insert into diagnosis_results (session_id, taxonomy_version, type_id, type_id_second, is_boundary, profile, similar_site_ids)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [sid, tv, typeId, order[1], notice === "boundary", JSON.stringify(profile), sites],
    );
    fixtures[key] = { anonId, sessionId: sid, typeId, notice };
  }
});
writeFileSync(join(ROOT, "e2e/.results.json"), JSON.stringify(fixtures, null, 2));
await db.close();
const web = join(ROOT, "apps/web");
// 같은 소스면 빌드를 다시 하지 않는다(apps/web/src·packages/*/dist·next 설정의 내용 해시, .next/.e2e-src-hash)
const files: string[] = [];
const walk = (d: string): void => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(join(web, "src"));
for (const pkg of readdirSync(join(ROOT, "packages"))) {
  const d = join(ROOT, "packages", pkg, "dist");
  if (existsSync(d)) walk(d);
}
files.push(join(web, "next.config.mjs"), join(web, "package.json"));
const h = createHash("sha256");
for (const f of files.sort()) h.update(f).update(readFileSync(f));
const srcHash = h.digest("hex");
const stamp = join(web, ".next/.e2e-src-hash");
if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== srcHash) {
  sh("pnpm", ["exec", "next", "build"], web);
  writeFileSync(stamp, srcHash);
}
const p = spawn("pnpm", ["exec", "next", "start", "-p", String(E2E_PORT)], {
  cwd: web,
  env,
  stdio: "inherit",
});
const stop = (): void => {
  p.kill("SIGTERM");
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
p.on("exit", (c) => process.exit(c ?? 0));
