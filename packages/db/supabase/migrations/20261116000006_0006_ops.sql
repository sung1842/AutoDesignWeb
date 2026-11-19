-- 원본: docs/spec/FINAL/06_architecture.md 6.3.3 DDL(0006_ops). 손으로 고치지 않는다(verify:schema-parity가 대조).
-- ===== 0006_ops =====
create table worker_heartbeats (
  worker_id    text primary key,
  version      text not null,                         -- git sha
  last_beat_at timestamptz not null,
  running_jobs smallint not null default 0
);
create table alert_state (                            -- 알림 중복 억제(6.12.4)
  rule_id       text primary key,
  last_fired_at timestamptz null,
  last_value    numeric null
);
