do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'exercise_attempts_exercise_type_check'
  ) then
    alter table public.exercise_attempts
      drop constraint exercise_attempts_exercise_type_check;
  end if;

  alter table public.exercise_attempts
    add constraint exercise_attempts_exercise_type_check
    check (
      exercise_type in (
        'meaning_match',
        'translation_match',
        'pair_match',
        'sentence_builder',
        'error_detection',
        'fill_blank',
        'context_meaning',
        'synonym',
        'collocation',
        'listen_match',
        'spelling_from_audio',
        'spelling',
        'memory',
        'speed_round'
      )
    );
end $$;
