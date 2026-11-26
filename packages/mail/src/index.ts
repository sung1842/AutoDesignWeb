// MailPort(06장 6.4.x 메일 템플릿, 6.13.1). 고정 문구는 templates/<id>.ko.md, 사용자 입력 본문 삽입 0(08장 8.9.5).
// 템플릿 형식(ASM-104): 첫 줄 `subject: …`, `---` 줄, 본문. 변수는 {{name}} 자리에만 들어간다.
import { readFileSync } from "node:fs";
import { q, type DbPort } from "@tastefit/db";

export const PACKAGE_NAME = "@tastefit/mail";

/** 6.4.x 메일 템플릿 표의 id → 변수. */
export interface MailVars {
  magic_link: { link: string };
}
export type MailTemplate = keyof MailVars;

export interface MailPort {
  send<T extends MailTemplate>(template: T, to: string, vars: MailVars[T]): Promise<void>;
}

const cache = new Map<string, { subject: string; body: string }>();
function load(id: MailTemplate): { subject: string; body: string } {
  const hit = cache.get(id);
  if (hit) return hit;
  const raw = readFileSync(new URL(`../templates/${id}.ko.md`, import.meta.url), "utf8");
  const m = /^subject:\s*(.+)\n---\n([\s\S]*)$/.exec(raw);
  if (!m?.[1] || m[2] === undefined) throw new Error(`mail: 템플릿 형식 오류 ${id}`);
  const t = { subject: m[1].trim(), body: m[2] };
  cache.set(id, t);
  return t;
}

/** 템플릿 + 변수 → 제목·본문. 정의되지 않은 변수 자리는 오류. */
export function renderMail<T extends MailTemplate>(
  id: T,
  vars: MailVars[T],
): { subject: string; body: string } {
  const t = load(id);
  const v = vars as unknown as Record<string, string>;
  const body = t.body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const x = v[k];
    if (x === undefined) throw new Error(`mail: 변수 누락 ${id}.${k}`);
    return x;
  });
  return { subject: t.subject, body };
}

/** local 드라이버: 발송하지 않고 dev_mail_outbox에 기록(6.13.1, APP_ENV=local 전용 테이블). */
export function createLocalMail(db: DbPort): MailPort {
  return {
    async send(template, to, vars) {
      const m = renderMail(template, vars);
      await db.withService((tx) =>
        q(tx, "insert into dev_mail_outbox (to_email, subject, body) values ($1, $2, $3)", [
          to,
          m.subject,
          m.body,
        ]),
      );
    },
  };
}
