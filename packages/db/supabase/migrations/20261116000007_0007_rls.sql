-- 06장 6.3.5 RLS 정책 표를 SQL로 옮긴 것(표가 원천, AD-029). 쓰기 화이트리스트는 다음 파일(0006_grants, 장 원문 그대로).
-- ① 모든 public 테이블 RLS enable + force
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- ② anon·authenticated 테이블 권한은 표의 SELECT 칸에 있는 테이블만 남긴다(정책 없는 테이블은 권한 거부, AC-05-04)
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ③ authenticated: 자기 소유 행 SELECT
grant select on users, projects, generation_jobs, candidates, mockup_versions, exports, mockups,
  llm_calls, quota_ledger, share_links, diagnosis_sessions, diagnosis_results, consents to authenticated;
create policy users_self_select on users for select to authenticated using (id = auth.uid());
create policy projects_owner_select on projects for select to authenticated using (owner_id = auth.uid());
create policy generation_jobs_owner_select on generation_jobs for select to authenticated using (owner_id = auth.uid());
create policy candidates_owner_select on candidates for select to authenticated using (owner_id = auth.uid());
create policy mockup_versions_owner_select on mockup_versions for select to authenticated using (owner_id = auth.uid());
create policy exports_owner_select on exports for select to authenticated using (owner_id = auth.uid());
create policy mockups_owner_select on mockups for select to authenticated using (owner_id = auth.uid());
create policy llm_calls_owner_select on llm_calls for select to authenticated using (owner_id = auth.uid());
create policy quota_ledger_owner_select on quota_ledger for select to authenticated using (user_id = auth.uid());
create policy share_links_owner_select on share_links for select to authenticated using (owner_user_id = auth.uid());
create policy diagnosis_sessions_owner_select on diagnosis_sessions for select to authenticated using (user_id = auth.uid());
create policy diagnosis_results_owner_select on diagnosis_results for select to authenticated
  using (exists (select 1 from diagnosis_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy consents_owner_select on consents for select to authenticated using (user_id = auth.uid());

-- ④ 공개 정보(anon·authenticated 동일): 활성 시즌·승인·활성 행만
grant select on taxonomy_releases, types, presets, survey_items to anon, authenticated;
create policy taxonomy_releases_public on taxonomy_releases for select to anon, authenticated using (status = 'active');
create policy types_public on types for select to anon, authenticated
  using (exists (select 1 from taxonomy_releases r where r.version = taxonomy_version and r.status = 'active'));
create policy presets_public on presets for select to anon, authenticated using (status = 'approved');
create policy survey_items_public on survey_items for select to anon, authenticated using (status = 'active');

-- ⑤ 사용자 쪽 레퍼런스 뷰(security_invoker=false, 스크린샷·원시 특징 없음)
alter view similar_site_candidates set (security_invoker = false);
grant select on similar_site_candidates to anon, authenticated;
