// S02 진단 화면(01장 1.4).
import { Survey } from "./survey";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Survey id={id} />;
}
