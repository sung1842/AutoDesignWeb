// M1 수용 테스트 픽스처 헬퍼(ASM-008). 실제 구현은 M1-07.
import type { DbPort } from "../port.js";

export interface Ownership {
  a: string;
  b: string;
  /** 사용자 A 소유 행 id(테이블 → id). */
  owned: Record<string, string>;
}

const todo = (what: string): Error => new Error(`미구현: ${what} (M1-07)`);

export function seedOwnership(db: DbPort): Promise<Ownership> {
  void db;
  return Promise.reject(todo("seedOwnership"));
}
export function insertSurveyItem(
  db: DbPort,
  o: { id: string; xCard: Record<string, number>; desktopBytes?: number },
): Promise<void> {
  void db;
  void o;
  return Promise.reject(todo("insertSurveyItem"));
}
export function insertJob(
  db: DbPort,
  o: { ownerId: string; status: string; costUsd?: number },
): Promise<string> {
  void db;
  void o;
  return Promise.reject(todo("insertJob"));
}
export function insertAuditLog(db: DbPort, o: { ageDays: number }): Promise<string> {
  void db;
  void o;
  return Promise.reject(todo("insertAuditLog"));
}
