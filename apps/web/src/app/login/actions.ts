"use server";
// S04·헤더 서버 액션(ASM-103 ①): 매직링크 요청·로그아웃. 쿠키는 서버가 httpOnly로만 쓴다(T-11).
import { cookies } from "next/headers";
import { logout, requestMagicLink } from "../../server/auth";
import { appDeps } from "../../server/next";

export async function sendMagicLink(
  email: string,
  next: string,
  turnstileToken: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    await requestMagicLink(appDeps(), { email, next, turnstileToken });
    return { ok: true };
  } catch (e) {
    return { ok: false, code: (e as { code?: string }).code ?? "INTERNAL" };
  }
}

/** 세션 폐기 + anon_id 재발급(6.5.2). logout()이 돌려준 Set-Cookie를 그대로 옮긴다. */
export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const h = await logout(
    appDeps(),
    new Request("http://local/", { headers: { cookie: jar.toString() } }),
  );
  for (const sc of h.getSetCookie()) {
    const [kv = "", ...attrs] = sc.split(";").map((x) => x.trim());
    const i = kv.indexOf("=");
    const name = kv.slice(0, i);
    const value = kv.slice(i + 1);
    const maxAge = Number(
      /^max-age=(\d+)$/i.exec(attrs.find((a) => /^max-age=/i.test(a)) ?? "")?.[1],
    );
    jar.set(name, value, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      ...(Number.isFinite(maxAge) ? { maxAge } : {}),
    });
  }
}
