-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(9000_local_only). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 9000_local_only: APP_ENV=local 전용(S-01). staging·prod 마이그레이션 목록에서 제외 =====
create table dev_mail_outbox (                        -- AuthPort·MailPort local 드라이버 발송함
  id          bigserial primary key,
  to_email    text not null,
  subject     text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
