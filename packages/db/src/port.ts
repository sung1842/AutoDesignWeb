// DbPort(06장 6.1.2 R-5, 6.3.5): 앱 쿼리는 withUser·withAnon·withService 트랜잭션 안에서만 실행한다.
//   withUser   → SET LOCAL ROLE authenticated + request.jwt.claims {sub, role, aal}
//   withAnon   → SET LOCAL ROLE anon + claims {role: anon}
//   withService→ SET LOCAL ROLE service_role (BYPASSRLS)
// native·supabase 공통으로 접속 사용자(tastefit_app 등)는 세 역할의 멤버여야 한다(shim, 6.13.1).
import pg from "pg";

export type Row = Record<string, unknown>;
export interface QueryResult {
  rows: Row[];
  rowCount: number;
}
/** withUser·withAnon·withService 안에서만 얻는 트랜잭션 핸들. */
export interface Tx {
  readonly __tx: unique symbol;
}
export type Aal = "aal1" | "aal2";
export interface DbPort {
  withUser<T>(uid: string, aal: Aal, fn: (tx: Tx) => Promise<T>): Promise<T>;
  withAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  withService<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const clients = new WeakMap<Tx, pg.PoolClient>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Role = "authenticated" | "anon" | "service_role";

export function createDbPort(connectionString: string): DbPort {
  const pool = new pg.Pool({ connectionString, max: 5 });

  async function run<T>(role: Role, claims: Row, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    const tx = Object.freeze({}) as Tx;
    clients.set(tx, client);
    try {
      await client.query("begin");
      await client.query(`set local role ${role}`);
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(claims),
      ]);
      const out = await fn(tx);
      await client.query("commit");
      return out;
    } catch (e) {
      await client.query("rollback").catch(() => undefined);
      throw e;
    } finally {
      clients.delete(tx);
      client.release();
    }
  }

  return {
    withUser(uid, aal, fn) {
      if (!UUID.test(uid)) return Promise.reject(new Error(`withUser: uid 형식 아님 ${uid}`));
      return run("authenticated", { sub: uid, role: "authenticated", aal }, fn);
    },
    withAnon(fn) {
      return run("anon", { role: "anon" }, fn);
    },
    withService(fn) {
      return run("service_role", { role: "service_role" }, fn);
    },
    close() {
      return pool.end();
    },
  };
}

export async function q(tx: Tx, text: string, params: unknown[] = []): Promise<QueryResult> {
  const client = clients.get(tx);
  if (!client) throw new Error("q: 트랜잭션 밖에서 쓸 수 없음(DbPort.with* 안에서만)");
  const r = await client.query(text, params);
  return { rows: r.rows as Row[], rowCount: r.rowCount ?? 0 };
}
