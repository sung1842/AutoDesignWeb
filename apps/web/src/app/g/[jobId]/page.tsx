// S07 생성 대기 → S08 시안 비교(01장 1.6·1.7). 같은 경로에서 상태에 따라 바뀐다.
import { Gen } from "./gen";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <Gen jobId={jobId} />;
}
