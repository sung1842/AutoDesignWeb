// S03 결과(01장 1.5.2) 소유자 보기. 공유 링크(/r/[shareId])는 M6(ASM-100 ②).
import { Result } from "./result";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Result id={id} />;
}
