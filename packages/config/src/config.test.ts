import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { EnvError, installNetworkGuard, isLocalHost, loadEnv, parseDotenv } from "./index.js";

const s32 = randomBytes(32).toString("base64");
const base = {
  APP_ENV: "local",
  WEB_ORIGIN: "http://127.0.0.1:3000",
  PREVIEW_ORIGIN: "http://localhost:3100",
  DATABASE_URL_DIRECT: "postgres://u:p@127.0.0.1:54322/db",
  LOCAL_JWT_SECRET: s32,
  PREVIEW_SIGNING_SECRET: s32,
  IP_HMAC_KEY: "k",
  CONSENT_HASH_KEY: s32,
  ADMIN_EMAILS: "a@example.com",
};

const issues = (svc: "web" | "worker", env: Record<string, string>): string[] => {
  try {
    loadEnv(svc, env);
    return [];
  } catch (e) {
    if (e instanceof EnvError) return e.issues.map((i) => i.name);
    throw e;
  }
};

describe("loadEnv", () => {
  it("local native 기본값으로 통과하고 STORAGE_PUBLIC_ORIGIN은 WEB_ORIGIN", () => {
    const e = loadEnv("web", base);
    expect(e.profile).toBe("native");
    expect(e.llmMode).toBe("mock");
    expect(e.values.STORAGE_PUBLIC_ORIGIN).toBe(base.WEB_ORIGIN);
  });
  it("누락된 필수 변수를 모두 보고한다(빈 문자열 = 미설정)", () => {
    expect(issues("web", { ...base, WEB_ORIGIN: "", ADMIN_EMAILS: "" })).toEqual([
      "WEB_ORIGIN",
      "ADMIN_EMAILS",
    ]);
  });
  it("worker는 web 전용 변수를 요구하지 않는다", () => {
    expect(issues("worker", { ...base, ADMIN_EMAILS: "", PREVIEW_SIGNING_SECRET: "" })).toEqual([]);
  });
  it("짧은 비밀값은 형식 오류", () => {
    expect(issues("web", { ...base, CONSENT_HASH_KEY: "short" })).toEqual(["CONSENT_HASH_KEY"]);
  });
  it("prod: mock·RETENTION_NOW·local 드라이버 거부", () => {
    const prod = {
      ...base,
      APP_ENV: "prod",
      STACK_PROFILE: "supabase",
      LLM_MODE: "mock",
      RETENTION_NOW: "x",
      AUTH_DRIVER: "local",
    };
    const got = issues("worker", prod);
    expect(got).toContain("LLM_MODE");
    expect(got).toContain("RETENTION_NOW");
    expect(got).toContain("AUTH_DRIVER");
    expect(got).toContain("SUPABASE_URL");
  });
  it("live 모드는 API 키 필수", () => {
    expect(issues("worker", { ...base, LLM_MODE: "live" })).toEqual([
      "LLM_PRIMARY_API_KEY",
      "LLM_SECONDARY_API_KEY",
    ]);
  });
});

describe("network guard", () => {
  it("로컬 호스트 판정", () => {
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("api.localhost")).toBe(true);
    expect(isLocalHost("example.com")).toBe(false);
  });
  it("NO_EXTERNAL_NETWORK 미설정이면 설치하지 않는다", () => {
    const f = globalThis.fetch;
    installNetworkGuard({})();
    expect(globalThis.fetch).toBe(f);
  });
  it("해제 후 fetch 원복", async () => {
    const f = globalThis.fetch;
    const restore = installNetworkGuard({ NO_EXTERNAL_NETWORK: "1" });
    await expect(fetch("https://example.com")).rejects.toMatchObject({
      code: "E_EXTERNAL_NETWORK",
    });
    restore();
    expect(globalThis.fetch).toBe(f);
  });
});

describe("parseDotenv", () => {
  it("주석·따옴표 처리", () => {
    expect(parseDotenv('# c\nA=1\nB="x y"\nC=\n')).toEqual({ A: "1", B: "x y", C: "" });
  });
});
