// S04 로그인(01장 1.5.3). Turnstile local 드라이버면 형식만 맞는 토큰을 쓴다(6.13.1).
import { Login } from "./login";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const local = process.env.TURNSTILE_DRIVER === "local" || process.env.APP_ENV === "local";
  return <Login next={sp.next ?? "/me"} error={sp.error ?? null} localTurnstile={local} />;
}
