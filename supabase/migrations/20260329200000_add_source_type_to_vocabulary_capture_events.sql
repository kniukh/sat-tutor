do $$
begin
  alter table public.vocabulary_capture_events
    add column if not exists source_type text;

  update public.vocabulary_capture_events
  set source_type = 'passage'
  where source_type is null;

  if exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_capture_events_source_type_check'
  ) then
    alter table public.vocabulary_capture_events
      drop constraint vocabulary_capture_events_source_type_check;
  end if;

  alter table public.vocabulary_capture_events
    alter column source_type set default 'passage';

  alter table public.vocabulary_capture_events
    alter column source_type set not null;

  alter table public.vocabulary_capture_events
    add constraint vocabulary_capture_events_source_type_check
    check (source_type in ('passage', 'question', 'answer'));

  create index if not exists idx_vocabulary_capture_events_student_lesson_source
    on public.vocabulary_capture_events (student_id, lesson_id, source_type, created_at desc);
end $$;
