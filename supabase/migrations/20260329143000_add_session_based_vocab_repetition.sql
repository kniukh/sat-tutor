create table if not exists public.vocab_sessions (
  session_id text primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  mode text null,
  sequence_index bigint not null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz null,
  exercise_count integer not null default 0 check (exercise_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocab_sessions_mode_check
    check (
      mode is null or mode in (
        'default_review',
        'weak_first',
        'mixed',
        'learn_new_words',
        'review_weak_words',
        'mixed_practice'
      )
    ),
  constraint vocab_sessions_student_sequence_unique
    unique (student_id, sequence_index)
);

alter table public.word_progress
  add column if not exists sessions_seen_count integer not null default 0,
  add column if not exists sessions_correct_count integer not null default 0,
  add column if not exists last_seen_session_id text null references public.vocab_sessions(session_id) on delete set null,
  add column if not exists last_correct_session_id text null references public.vocab_sessions(session_id) on delete set null,
  add column if not exists next_review_session_gap integer null,
  add column if not exists next_review_session_index bigint null,
  add column if not exists minimum_time_gap_for_retention_check interval null,
  add column if not exists last_progress_credited_session_id text null references public.vocab_sessions(session_id) on delete set null;

update public.word_progress
set
  sessions_seen_count = greatest(coalesce(sessions_seen_count, 0), coalesce(total_attempts, 0)),
  sessions_correct_count = greatest(coalesce(sessions_correct_count, 0), coalesce(correct_attempts, 0)),
  next_review_session_gap = coalesce(next_review_session_gap, 1),
  minimum_time_gap_for_retention_check = coalesce(minimum_time_gap_for_retention_check, interval '1 day')
where sessions_seen_count = 0
   or sessions_correct_count = 0
   or next_review_session_gap is null
   or minimum_time_gap_for_retention_check is null;

alter table public.review_queue
  add column if not exists metadata jsonb not null default '{}'::jsonb;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_sessions_seen_count_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_sessions_seen_count_check
      check (sessions_seen_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_sessions_correct_count_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_sessions_correct_count_check
      check (sessions_correct_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_next_review_session_gap_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_next_review_session_gap_check
      check (next_review_session_gap is null or next_review_session_gap >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_next_review_session_index_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_next_review_session_index_check
      check (next_review_session_index is null or next_review_session_index >= 0);
  end if;
end $$;

create index if not exists idx_vocab_sessions_student_sequence
  on public.vocab_sessions(student_id, sequence_index desc);

create index if not exists idx_vocab_sessions_student_last_activity
  on public.vocab_sessions(student_id, last_activity_at desc);

create index if not exists idx_word_progress_student_next_review_session_index
  on public.word_progress(student_id, next_review_session_index);

create index if not exists idx_word_progress_last_progress_credited_session
  on public.word_progress(last_progress_credited_session_id);

drop trigger if exists trg_vocab_sessions_set_updated_at on public.vocab_sessions;
create trigger trg_vocab_sessions_set_updated_at
before update on public.vocab_sessions
for each row
execute function public.set_updated_at();

comment on table public.vocab_sessions is
  'Session-level vocabulary practice records. Used to drive session-based repetition and separate it from day-based habit streaks.';

comment on column public.word_progress.sessions_seen_count is
  'Primary repetition credit count. Incremented at most once per word per session.';

comment on column public.word_progress.next_review_session_index is
  'The earliest future vocabulary session index where the word becomes due by session progression.';

comment on column public.word_progress.minimum_time_gap_for_retention_check is
  'Minimum real-world time gap required before a retention check can surface the word again, even if session pacing is fast.';

comment on column public.review_queue.metadata is
  'Debug-friendly due reasons such as due_by_session_gap, due_by_time_gap, overdue_review, weak_again_retry, and same_session_credit_capped.';
