alter table if exists public.student_gamification
  add column if not exists total_xp integer not null default 0,
  add column if not exists weekly_xp integer not null default 0,
  add column if not exists weekly_xp_started_at date not null default current_date,
  add column if not exists longest_streak_days integer not null default 0;

update public.student_gamification
set
  total_xp = greatest(coalesce(total_xp, 0), coalesce(xp, 0)),
  xp = greatest(coalesce(xp, 0), coalesce(total_xp, 0)),
  weekly_xp = case
    when coalesce(last_activity_date, current_date) >= date_trunc('week', current_date)::date
      then greatest(coalesce(weekly_xp, 0), coalesce(xp, 0), coalesce(total_xp, 0))
    else 0
  end,
  weekly_xp_started_at = coalesce(weekly_xp_started_at, date_trunc('week', current_date)::date),
  longest_streak_days = greatest(
    coalesce(longest_streak_days, 0),
    coalesce(streak_days, 0)
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_gamification_total_xp_check'
  ) then
    alter table public.student_gamification
      add constraint student_gamification_total_xp_check
      check (total_xp >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_gamification_weekly_xp_check'
  ) then
    alter table public.student_gamification
      add constraint student_gamification_weekly_xp_check
      check (weekly_xp >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_gamification_longest_streak_days_check'
  ) then
    alter table public.student_gamification
      add constraint student_gamification_longest_streak_days_check
      check (longest_streak_days >= 0);
  end if;
end $$;

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_key text null unique,
  event_type text not null,
  question_attempt_id uuid null references public.question_attempts(id) on delete set null,
  exercise_attempt_id uuid null references public.exercise_attempts(id) on delete set null,
  lesson_attempt_id uuid null references public.lesson_attempts(id) on delete set null,
  vocab_session_id text null references public.vocab_sessions(session_id) on delete set null,
  lesson_id uuid null references public.lessons(id) on delete set null,
  target_word_id uuid null references public.vocabulary_item_details(id) on delete set null,
  target_word text null,
  xp_awarded integer not null default 0,
  total_xp_after integer null,
  weekly_xp_after integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint xp_events_event_type_check
    check (
      event_type in (
        'generic_activity',
        'reading_question_attempt',
        'reading_lesson_complete',
        'vocab_exercise_attempt',
        'vocab_session_complete',
        'writing_submission',
        'legacy_vocab_review'
      )
    ),
  constraint xp_events_xp_awarded_check
    check (xp_awarded >= 0)
);

create index if not exists idx_xp_events_student_created_at
  on public.xp_events(student_id, created_at desc);

create index if not exists idx_xp_events_event_type
  on public.xp_events(event_type, created_at desc);

create index if not exists idx_xp_events_vocab_session
  on public.xp_events(vocab_session_id);

create index if not exists idx_xp_events_exercise_attempt
  on public.xp_events(exercise_attempt_id);

create index if not exists idx_xp_events_question_attempt
  on public.xp_events(question_attempt_id);

create index if not exists idx_xp_events_target_word_session
  on public.xp_events(student_id, vocab_session_id, target_word_id, created_at desc);

comment on table public.xp_events is
  'Structured XP ledger for learning activity. Used for anti-abuse controls, weekly XP rollups, and debug-friendly reward breakdowns.';
