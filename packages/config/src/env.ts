// 서비스별 env 검증(06장 6.13.2). 누락·형식 오류 시 변수 이름을 모두 모아 보고한다.
import { z } from "zod";

export type Service = "web" | "worker";
export type RawEnv = Record<string, string | undefined>;

const APP_ENVS = ["local", "staging", "prod"] as const;
const LLM_MODES = ["mock", "replay", "record", "live"] as const;
const PROFILES = ["supabase", "native"] as const;

const origin = z.url({ protocol: /^https?$/ });
const secret32 = z.string().refine((s) => Buffer.byteLength(s) >= 32, "32바이트 이상");
const base64Secret32 = z
  .string()
  .refine(
    (s) => /^[A-Za-z0-9+/_-]+={0,2}$/.test(s) && Buffer.from(s, "base64").length >= 32,
    "32바이트 이상 base64",
  );

export interface EnvIssue {
  name: string;
  message: string;
}

export class EnvError extends Error {
  readonly issues: EnvIssue[];
  constructor(service: Service, issues: EnvIssue[]) {
    super(`[${service}] env 오류: ${issues.map((i) => `${i.name}(${i.message})`).join(", ")}`);
    this.name = "EnvError";
    this.issues = issues;
  }
}

/** 빈 문자열은 미설정으로 본다. */
function clean(env: RawEnv): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && v !== "") o[k] = v;
  return o;
}

interface Rule {
  name: string;
  services: readonly Service[];
  required: (ctx: Ctx) => boolean;
  schema: z.ZodType<string>;
}
interface Ctx {
  appEnv: (typeof APP_ENVS)[number] | undefined;
  profile: (typeof PROFILES)[number];
  llmMode: string | undefined;
}

const always = (): boolean => true;
const hosted = (c: Ctx): boolean => c.profile === "supabase" || c.appEnv !== "local";
const BOTH = ["web", "worker"] as const;

const RULES: readonly Rule[] = [
  { name: "APP_ENV", services: BOTH, required: always, schema: z.enum(APP_ENVS) },
  { name: "STACK_PROFILE", services: BOTH, required: () => false, schema: z.enum(PROFILES) },
  { name: "WEB_ORIGIN", services: BOTH, required: always, schema: origin },
  { name: "PREVIEW_ORIGIN", services: BOTH, required: always, schema: origin },
  {
    name: "STORAGE_PUBLIC_ORIGIN",
    services: BOTH,
    required: (c) => c.profile !== "native",
    schema: origin,
  },
  {
    name: "LOCAL_JWT_SECRET",
    services: ["web"],
    required: (c) => c.profile === "native",
    schema: secret32,
  },
  {
    name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    services: ["web"],
    required: (c) => c.appEnv !== "local",
    schema: z.string(),
  },
  { name: "SUPABASE_URL", services: BOTH, required: hosted, schema: origin },
  { name: "SUPABASE_ANON_KEY", services: ["web"], required: hosted, schema: z.string() },
  { name: "SUPABASE_SERVICE_ROLE_KEY", services: BOTH, required: hosted, schema: z.string() },
  {
    name: "DATABASE_URL_POOLED",
    services: ["web"],
    required: hosted,
    schema: z.string().startsWith("postgres"),
  },
  {
    name: "DATABASE_URL_DIRECT",
    services: BOTH,
    required: always,
    schema: z.string().startsWith("postgres"),
  },
  { name: "PREVIEW_SIGNING_SECRET", services: ["web"], required: always, schema: base64Secret32 },
  {
    name: "PREVIEW_SIGNING_SECRET_PREV",
    services: ["web"],
    required: () => false,
    schema: base64Secret32,
  },
  { name: "IP_HMAC_KEY", services: ["web"], required: always, schema: z.string() },
  { name: "CONSENT_HASH_KEY", services: BOTH, required: always, schema: secret32 },
  { name: "ADMIN_EMAILS", services: ["web"], required: always, schema: z.string() },
  {
    name: "LLM_MODE",
    services: ["worker"],
    required: (c) => c.appEnv !== "local",
    schema: z.enum(LLM_MODES),
  },
  {
    name: "LLM_PRIMARY_API_KEY",
    services: ["worker"],
    required: (c) => c.llmMode === "live",
    schema: z.string(),
  },
  {
    name: "LLM_SECONDARY_API_KEY",
    services: ["worker"],
    required: (c) => c.llmMode === "live",
    schema: z.string(),
  },
];

export interface AppEnv {
  service: Service;
  values: Readonly<Record<string, string>>;
  appEnv: (typeof APP_ENVS)[number];
  profile: (typeof PROFILES)[number];
  llmMode: (typeof LLM_MODES)[number];
}

/** env를 검증한다. 실패하면 EnvError(모든 문제 변수 포함). */
export function loadEnv(service: Service, raw: RawEnv = process.env): AppEnv {
  const env = clean(raw);
  const appEnvParsed = z.enum(APP_ENVS).safeParse(env.APP_ENV);
  const profile = env.STACK_PROFILE === "supabase" ? "supabase" : "native";
  const ctx: Ctx = {
    appEnv: appEnvParsed.success ? appEnvParsed.data : undefined,
    profile,
    llmMode: env.LLM_MODE ?? (env.APP_ENV === "local" ? "mock" : undefined),
  };
  const issues: EnvIssue[] = [];
  for (const r of RULES) {
    if (!r.services.includes(service)) continue;
    const v = env[r.name];
    if (v === undefined) {
      if (r.required(ctx)) issues.push({ name: r.name, message: "필수 값 누락" });
      continue;
    }
    const p = r.schema.safeParse(v);
    if (!p.success)
      issues.push({ name: r.name, message: p.error.issues[0]?.message ?? "형식 오류" });
  }
  if (ctx.appEnv === "prod") {
    if (service === "worker" && ctx.llmMode !== "live")
      issues.push({ name: "LLM_MODE", message: "prod는 live만 허용" });
    for (const n of ["RETENTION_NOW", "MOCK_LLM_SCENARIO", "MOCK_LLM_LATENCY_MS"]) {
      if (env[n] !== undefined) issues.push({ name: n, message: "prod에서 설정 금지" });
    }
  }
  if (ctx.appEnv !== undefined && ctx.appEnv !== "local") {
    for (const n of ["AUTH_DRIVER", "STORAGE_DRIVER", "MAIL_DRIVER", "TURNSTILE_DRIVER"]) {
      const v = env[n];
      if (v === "local" || v === "fs")
        issues.push({ name: n, message: "local 외 환경에서 local·fs 드라이버 금지" });
    }
  }
  if (issues.length > 0) throw new EnvError(service, issues);
  const values = { ...env };
  if (
    profile === "native" &&
    values.STORAGE_PUBLIC_ORIGIN === undefined &&
    values.WEB_ORIGIN !== undefined
  ) {
    values.STORAGE_PUBLIC_ORIGIN = values.WEB_ORIGIN;
  }
  return {
    service,
    values,
    appEnv: ctx.appEnv ?? "local",
    profile,
    llmMode: z.enum(LLM_MODES).parse(ctx.llmMode ?? "mock"),
  };
}

/** 기동 진입점용: 실패하면 stderr에 변수명을 출력하고 종료 코드 1로 끝낸다. */
export function loadEnvOrExit(service: Service, raw: RawEnv = process.env): AppEnv {
  try {
    return loadEnv(service, raw);
  } catch (e) {
    if (e instanceof EnvError) {
      for (const i of e.issues) process.stderr.write(`[${service}] env ${i.name}: ${i.message}\n`);
      process.exit(1);
    }
    throw e;
  }
}
