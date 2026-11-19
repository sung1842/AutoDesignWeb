// GET /api/health (09장 9.4.2 ③, AC-06-50): 200 {status, db, queue}
import { stackHealth, webConnectionString } from "@tastefit/db";
import { serverEnv } from "../../../server-env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const h = await stackHealth(webConnectionString(serverEnv().values));
  const ok = h.db === "ok" && h.queue === "ok";
  return Response.json({ status: ok ? "ok" : "degraded", ...h }, { status: ok ? 200 : 503 });
}
