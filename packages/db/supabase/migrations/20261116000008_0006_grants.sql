-- 원본: docs/spec/FINAL/06_architecture.md 6.3.5 SQL 블록(0006_grants). 손으로 고치지 않는다. 적용 순서상 0007_rls 뒤.
-- ===== 0006_grants: 쓰기 화이트리스트(T-11). 이 블록과 위 표가 grants.snapshot.json의 원천 =====
revoke insert, update, delete on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete on tables from anon, authenticated;
grant update (display_name) on users to authenticated;
create policy users_self_update on users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
grant update (feedback, feedback_at, selected_at) on mockups to authenticated;
create policy mockups_owner_update on mockups for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function require_service_role() returns trigger language plpgsql as $$
begin
  if current_user <> 'service_role' then
    raise exception '% % requires service_role', tg_table_name, tg_op using errcode = '42501';
  end if;
  return new;
end $$;
create trigger mockup_versions_service_only before insert on mockup_versions
  for each row execute function require_service_role();
create trigger share_links_hidden_service_only before update on share_links
  for each row when (old.hidden_at is distinct from new.hidden_at or old.hidden_reason is distinct from new.hidden_reason)
  execute function require_service_role();
-- security definer 함수(소유자 = 마이그레이션 사용자) 안의 current_user는 소유자다. 6.3.4 함수는 버전·숨김을 바꾸지 않으므로 예외 목록이 없다.
-- supabase 프로파일에서 service_role 판정이 다른 이름(postgres)으로 들어오는 경로는 needs_ci supabase-rest-rls에서 확인한다.
