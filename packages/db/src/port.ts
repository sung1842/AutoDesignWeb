// DbPort(06장 R-5) 자리. 실제 구현은 M1-07(RLS·DbPort). 지금은 M1 수용 테스트 수집용 계약만 둔다(ASM-008).
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

const todo = (what: string): Error => new Error(`미구현: ${what} (M1-07)`);

export function createDbPort(connectionString: string): DbPort {
  void connectionString;
  throw todo("createDbPort");
}

export function q(tx: Tx, text: string, params: unknown[] = []): Promise<QueryResult> {
  void tx;
  void text;
  void params;
  return Promise.reject(todo("q"));
}
