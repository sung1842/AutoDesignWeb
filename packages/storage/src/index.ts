// StoragePort(06장 6.13.1): put·get·remove·list·signedUrl·publicUrl. 드라이버 fs(local 전용)·supabase.
// fs: `<root>/<bucket>/<path>`(기본 /tmp/tastefit-storage), 서명 URL = `${webOrigin}/api/_storage/<bucket>/<path>?exp&sig`(HMAC),
// publicUrl = `${webOrigin}/api/_storage/public/<bucket>/<path>`(public 버킷만).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

export const PACKAGE_NAME = "@tastefit/storage";

/** 06장 Storage 버킷 표의 public 버킷. */
export const PUBLIC_BUCKETS: ReadonlySet<string> = new Set(["survey-assets"]);

export interface PutResult {
  /** 같은 바이트가 이미 있어 쓰지 않았으면 false(멱등 업로드). */
  written: boolean;
  sha256: string;
  bytes: number;
}
export interface StoragePort {
  put(bucket: string, path: string, body: Buffer, o?: { contentType?: string }): Promise<PutResult>;
  get(bucket: string, path: string): Promise<Buffer | null>;
  remove(bucket: string, path: string): Promise<void>;
  list(bucket: string, prefix?: string): Promise<string[]>;
  signedUrl(bucket: string, path: string, ttlSec: number): Promise<string>;
  publicUrl(bucket: string, path: string): string;
}

export const sha256Hex = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

export interface FsStorageOptions {
  root?: string;
  webOrigin: string;
  /** 서명 URL HMAC 키(LOCAL_JWT_SECRET). */
  secret: string;
  now?: () => number;
}
export const FS_DEFAULT_ROOT = join(tmpdir(), "tastefit-storage");
const SEG = /^[A-Za-z0-9._-]+$/;

function safe(root: string, bucket: string, path: string): string {
  if (!SEG.test(bucket)) throw new Error(`storage: 버킷 이름 ${bucket}`);
  const segs = path.split("/");
  if (!path || segs.some((s) => !SEG.test(s) || s === "." || s === ".."))
    throw new Error(`storage: 경로 ${path}`);
  const p = resolve(root, bucket, ...segs);
  if (!p.startsWith(resolve(root, bucket) + sep)) throw new Error(`storage: 경로 이탈 ${path}`);
  return p;
}

const sigOf = (secret: string, bucket: string, path: string, exp: number): string =>
  createHmac("sha256", secret).update(`${bucket}/${path}:${exp}`).digest("base64url");

/** fs 드라이버 서명 검증(`/api/_storage/*` 라우트용). */
export function verifyFsSignature(
  secret: string,
  bucket: string,
  path: string,
  exp: number,
  sig: string,
  nowSec: number,
): boolean {
  if (!Number.isFinite(exp) || exp < nowSec) return false;
  const a = Buffer.from(sigOf(secret, bucket, path, exp));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createFsStorage(o: FsStorageOptions): StoragePort {
  const root = o.root ?? FS_DEFAULT_ROOT;
  const now = o.now ?? Date.now;
  const origin = o.webOrigin.replace(/\/$/, "");
  return {
    async put(bucket, path, body) {
      const f = safe(root, bucket, path);
      const sha = sha256Hex(body);
      if (existsSync(f) && sha256Hex(readFileSync(f)) === sha)
        return { written: false, sha256: sha, bytes: body.length };
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, body);
      return { written: true, sha256: sha, bytes: body.length };
    },
    async get(bucket, path) {
      const f = safe(root, bucket, path);
      return existsSync(f) ? readFileSync(f) : null;
    },
    async remove(bucket, path) {
      rmSync(safe(root, bucket, path), { force: true });
    },
    async list(bucket, prefix = "") {
      if (!SEG.test(bucket)) throw new Error(`storage: 버킷 이름 ${bucket}`);
      const base = join(root, bucket);
      const out: string[] = [];
      const walk = (d: string): void => {
        if (!existsSync(d)) return;
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          if (statSync(p).isDirectory()) walk(p);
          else out.push(relative(base, p).split(sep).join("/"));
        }
      };
      walk(base);
      return out.filter((p) => p.startsWith(prefix)).sort();
    },
    async signedUrl(bucket, path, ttlSec) {
      safe(root, bucket, path);
      const exp = Math.floor(now() / 1000) + ttlSec;
      return `${origin}/api/_storage/${bucket}/${path}?exp=${exp}&sig=${sigOf(o.secret, bucket, path, exp)}`;
    },
    publicUrl(bucket, path) {
      if (!PUBLIC_BUCKETS.has(bucket)) throw new Error(`storage: ${bucket}는 public 버킷 아님`);
      safe(root, bucket, path);
      return `${origin}/api/_storage/public/${bucket}/${path}`;
    },
  };
}
