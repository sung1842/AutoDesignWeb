// S05 첫 동의(01장 1.5.4 = 08장 8.7.4 B).
import { Consent } from "./consent";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return <Consent next={sp.next ?? "/me"} />;
}
