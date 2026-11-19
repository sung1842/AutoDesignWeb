-- local 전용 테이블에도 6.3.5 "모든 public 테이블 RLS enable·force"를 적용한다(0007_rls 이후에 생기므로 여기서 다시, AD-029).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;
-- anon·authenticated 권한은 0007의 기본 권한 revoke로 이미 0이다.
