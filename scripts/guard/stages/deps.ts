// guard:deps — 허용 목록·사용처·라이선스(09장 9.5.5 F12, 9.1.3, AC-09-09).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readJson, readText, type Finding } from "../lib.js";

const ALLOWLIST = "docs/dependency-allowlist.md";
const LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "OFL-1.1"]);
/** BLK-001(locked-conflict)에 기록된 패키지·라이선스 쌍. 이 밖의 위반은 FAIL. */
const BLK_001: ReadonlyArray<[RegExp, string]> = [
  [/^@img\/sharp-libvips-/, "LGPL-3.0-or-later"],
  [/^caniuse-lite$/, "CC-BY-4.0"],
  [/^(minimatch|@isaacs\/nonrecursive-glob-match)$/, "BlueOak-1.0.0"],
  [/^argparse$/, "Python-2.0"],
  [/^tslib$/, "0BSD"],
  [/^type-fest$/, "(MIT OR CC0-1.0)"],
];

/** 사용처 제한(9.1.3·D-28): [패턴, 허용 워크스페이스 경로 정규식]. */
const PLACES: ReadonlyArray<[RegExp, RegExp, string]> = [
  [
    /^(playwright|playwright-core|@playwright\/test)$/,
    /^(\.|apps\/worker|packages\/extractor)$/,
    "playwright 계열은 web 금지",
  ],
  [/^(ai|@ai-sdk\/.+)$/, /^packages\/llm$/, "provider SDK는 packages/llm만"],
  [/^(pg|kysely|kysely-codegen|@types\/pg)$/, /^packages\/db$/, "pg·kysely는 packages/db만"],
  [/^pg-boss$/, /^(apps\/worker|packages\/db)$/, "pg-boss는 worker·db만"],
  [
    /^@supabase\/supabase-js$/,
    /^packages\/(auth|storage)$/,
    "supabase-js는 auth·storage 드라이버만",
  ],
  [/^@radix-ui\/.+$/, /^packages\/ui$/, "radix는 packages/ui만"],
  [/^tailwindcss$/, /^packages\/ui$/, "tailwindcss는 packages/ui만(renderer 금지)"],
  [/^(lucide-react|shadcn.*|@shadcn\/.+)$/, /^$/, "lucide-react·shadcn 금지(D-28)"],
];

function allowedNames(): { exact: Set<string>; prefix: string[] } {
  const exact = new Set<string>();
  const prefix: string[] = [];
  for (const line of readText(ALLOWLIST).split("\n")) {
    const m = /^\|\s*([^|]+?)\s*\|/.exec(line);
    if (!m || !m[1] || /^(패키지|-+)$/.test(m[1])) continue;
    for (const name of m[1].split(",").map((s) => s.trim())) {
      if (name.endsWith("/*")) prefix.push(name.slice(0, -1));
      else if (name) exact.add(name);
    }
  }
  return { exact, prefix };
}

function workspaces(): string[] {
  const out = ["."];
  for (const top of ["apps", "packages"]) {
    if (existsSync(top))
      for (const n of readdirSync(top))
        if (existsSync(join(top, n, "package.json"))) out.push(`${top}/${n}`);
  }
  return out;
}

export function depsStage(opts: { licenses?: boolean } = {}): Finding[] {
  const out: Finding[] = [];
  const f = (m: string): void =>
    void out.push({ stage: "guard:deps", fid: "F12", status: "fail", message: m });
  const { exact, prefix } = allowedNames();
  for (const ws of workspaces()) {
    const pj = readJson<Record<string, Record<string, string> | undefined>>(
      join(ws, "package.json"),
    );
    const deps = {
      ...(pj.dependencies ?? {}),
      ...(pj.devDependencies ?? {}),
      ...(pj.optionalDependencies ?? {}),
    };
    for (const name of Object.keys(deps)) {
      if (name.startsWith("@tastefit/")) continue;
      if (!exact.has(name) && !prefix.some((p) => name.startsWith(p)))
        f(`${ws}/package.json: 허용 목록 밖 의존성 ${name}`);
      for (const [re, where, why] of PLACES)
        if (re.test(name) && !where.test(ws)) f(`${ws}/package.json: ${name} — ${why}`);
    }
  }
  if (opts.licenses !== false) {
    const r = spawnSync("pnpm", ["licenses", "list", "--json"], {
      encoding: "utf8",
      maxBuffer: 64 << 20,
    });
    if (r.status !== 0) f(`pnpm licenses list 실패: ${r.stderr.slice(0, 200)}`);
    else {
      const byLic = JSON.parse(r.stdout) as Record<string, Array<{ name: string }>>;
      for (const [lic, pkgs] of Object.entries(byLic)) {
        if (LICENSES.has(lic)) continue;
        for (const p of pkgs) {
          if (BLK_001.some(([re, l]) => re.test(p.name) && l === lic)) {
            out.push({
              stage: "guard:deps",
              fid: "F12",
              status: "blocked",
              blockedBy: "BLK-001",
              message: `${p.name}: ${lic}`,
            });
          } else f(`라이선스 허용 밖: ${p.name} (${lic})`);
        }
      }
    }
  }
  return out;
}
