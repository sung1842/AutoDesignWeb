// pnpm env:init — 로컬 전용 비밀값을 무작위로 만들어 .env.local(커밋 금지)에 쓴다. 이미 있으면 그대로 둔다.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PATH = ".env.local";
const SECRETS = [
  "LOCAL_JWT_SECRET",
  "PREVIEW_SIGNING_SECRET",
  "IP_HMAC_KEY",
  "CONSENT_HASH_KEY",
] as const;

const cur = existsSync(PATH) ? readFileSync(PATH, "utf8") : "";
const have = new Set([...cur.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
const add = SECRETS.filter((k) => !have.has(k)).map(
  (k) => `${k}=${randomBytes(32).toString("base64")}`,
);
if (add.length > 0) {
  writeFileSync(PATH, `${cur}${cur && !cur.endsWith("\n") ? "\n" : ""}${add.join("\n")}\n`, {
    mode: 0o600,
  });
}
process.stdout.write(`env:init: ${add.length}개 생성 (${PATH})\n`);
