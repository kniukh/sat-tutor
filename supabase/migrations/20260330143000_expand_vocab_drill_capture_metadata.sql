do $$
begin
  alter table public.vocabulary_capture_events
    add column if not exists metadata jsonb not null default '{}'::jsonb;

  if exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_capture_events_source_type_check'
  ) then
    alter table public.vocabulary_capture_events
      drop constraint vocabulary_capture_events_source_type_check;
  end if;

  alter table public.vocabulary_capture_events
    add constraint vocabulary_capture_events_source_type_check
    check (source_type in ('passage', 'question', 'answer', 'vocab_drill'));
end $$;
