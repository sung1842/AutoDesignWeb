-- 05장 5.3.7 "released 행은 불변(UPDATE 금지 트리거)"(06장 6.3.3 normalizers 주석 구현, ASM-080 ⑥).
-- released → superseded 상태 전환만 허용한다(다른 열은 그대로여야 함). service role도 예외 없음.
create or replace function normalizers_released_immutable() returns trigger
language plpgsql as $$
begin
  if old.status = 'released' then
    if new.status = 'superseded'
       and new.version = old.version and new.body = old.body
       and new.corpus_hash = old.corpus_hash
       and new.released_at is not distinct from old.released_at then
      return new;
    end if;
    raise exception 'normalizers: released 행 % 은 변경할 수 없다(05장 5.3.7)', old.version
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger normalizers_released_immutable
  before update on normalizers
  for each row execute function normalizers_released_immutable();
