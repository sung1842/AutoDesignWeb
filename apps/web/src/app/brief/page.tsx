// S06 브리프 입력(01장 1.5.5). 쿼리: result(필수), draft·autosubmit(로그인 게이트 복귀, R-26).
import { Brief } from "./brief";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; draft?: string; autosubmit?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Brief
      resultId={sp.result ?? ""}
      draftId={sp.draft ?? null}
      autosubmit={sp.autosubmit === "1"}
    />
  );
}
