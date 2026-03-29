create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid null references public.lessons(id) on delete set null,
  session_id text not null,
  exercise_id text not null,
  exercise_type text not null,
  target_word_id uuid null references public.vocabulary_item_details(id) on delete set null,
  target_word text null,
  modality text null,
  difficulty_band text null,
  user_answer jsonb not null,
  correct_answer jsonb not null,
  is_correct boolean not null,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  response_time_ms integer not null check (response_time_ms >= 0),
  confidence numeric null check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint exercise_attempts_exercise_type_check
    check (
      exercise_type in (
        'translation_match',
        'fill_blank',
        'context_meaning',
        'synonym',
        'collocation',
        'listen_match',
        'spelling',
        'memory',
        'speed_round'
      )
    ),
  constraint exercise_attempts_modality_check
    check (
      modality is null or modality in ('text', 'context', 'audio', 'memory', 'mixed')
    ),
  constraint exercise_attempts_difficulty_band_check
    check (
      difficulty_band is null or difficulty_band in ('easy', 'medium', 'hard')
    )
);

create table if not exists public.word_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  word text not null,
  word_id uuid null references public.vocabulary_item_details(id) on delete set null,
  status text not null default 'learning',
  lifecycle_state text not null default 'learning',
  current_difficulty_band text null,
  mastery_score numeric not null default 0,
  total_attempts integer not null default 0,
  correct_attempts integer not null default 0,
  times_seen integer not null default 0,
  times_correct integer not null default 0,
  times_wrong integer not null default 0,
  last_seen_at timestamptz null,
  next_review_date date null,
  next_review_at timestamptz null,
  consecutive_correct integer not null default 0,
  consecutive_incorrect integer not null default 0,
  last_modality text null,
  source_lesson_id uuid null references public.lessons(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint word_progress_lifecycle_state_check
    check (lifecycle_state in ('new', 'learning', 'review', 'mastered', 'weak')),
  constraint word_progress_status_check
    check (status in ('learning', 'review', 'mastered')),
  constraint word_progress_current_difficulty_band_check
    check (
      current_difficulty_band is null or current_difficulty_band in ('easy', 'medium', 'hard')
    ),
  constraint word_progress_mastery_score_check
    check (mastery_score >= 0),
  constraint word_progress_total_attempts_check
    check (total_attempts >= 0),
  constraint word_progress_correct_attempts_check
    check (correct_attempts >= 0),
  constraint word_progress_consecutive_correct_check
    check (consecutive_correct >= 0),
  constraint word_progress_consecutive_incorrect_check
    check (consecutive_incorrect >= 0),
  constraint word_progress_last_modality_check
    check (
      last_modality is null or last_modality in ('text', 'context', 'audio', 'memory', 'mixed')
    )
);

alter table public.word_progress
  add column if not exists word_id uuid null references public.vocabulary_item_details(id) on delete set null,
  add column if not exists lifecycle_state text,
  add column if not exists current_difficulty_band text null,
  add column if not exists mastery_score numeric not null default 0,
  add column if not exists total_attempts integer not null default 0,
  add column if not exists correct_attempts integer not null default 0,
  add column if not exists last_seen_at timestamptz null,
  add column if not exists next_review_at timestamptz null,
  add column if not exists consecutive_correct integer not null default 0,
  add column if not exists consecutive_incorrect integer not null default 0,
  add column if not exists last_modality text null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.word_progress
set
  lifecycle_state = case
    when coalesce(status, 'learning') = 'mastered' then 'mastered'
    when coalesce(status, 'learning') = 'review' then 'review'
    else 'learning'
  end,
  next_review_at = coalesce(next_review_at, next_review_date::timestamptz),
  total_attempts = greatest(total_attempts, coalesce(times_seen, 0)),
  correct_attempts = greatest(correct_attempts, coalesce(times_correct, 0)),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where lifecycle_state is null
   or next_review_at is null
   or total_attempts = 0
   or correct_attempts = 0
   or created_at is null
   or updated_at is null;

alter table public.word_progress
  alter column lifecycle_state set default 'learning';

alter table public.word_progress
  alter column lifecycle_state set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_lifecycle_state_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_lifecycle_state_check
      check (lifecycle_state in ('new', 'learning', 'review', 'mastered', 'weak'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_status_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_status_check
      check (status in ('learning', 'review', 'mastered'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_current_difficulty_band_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_current_difficulty_band_check
      check (
        current_difficulty_band is null or current_difficulty_band in ('easy', 'medium', 'hard')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'word_progress_last_modality_check'
  ) then
    alter table public.word_progress
      add constraint word_progress_last_modality_check
      check (
        last_modality is null or last_modality in ('text', 'context', 'audio', 'memory', 'mixed')
      );
  end if;
end $$;

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  word_id uuid not null references public.vocabulary_item_details(id) on delete cascade,
  priority_score numeric not null default 0,
  scheduled_for timestamptz not null,
  reason text not null,
  recommended_modality text null,
  source_attempt_id uuid null references public.exercise_attempts(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_queue_status_check
    check (status in ('pending', 'scheduled', 'completed', 'skipped', 'cancelled')),
  constraint review_queue_recommended_modality_check
    check (
      recommended_modality is null
      or recommended_modality in ('text', 'context', 'audio', 'memory', 'mixed')
    )
);

create index if not exists idx_exercise_attempts_student_created_at
  on public.exercise_attempts(student_id, created_at desc);

create index if not exists idx_exercise_attempts_session_id
  on public.exercise_attempts(session_id);

create index if not exists idx_exercise_attempts_lesson_id
  on public.exercise_attempts(lesson_id);

create index if not exists idx_exercise_attempts_target_word_id
  on public.exercise_attempts(target_word_id);

create index if not exists idx_exercise_attempts_exercise_type
  on public.exercise_attempts(exercise_type);

create index if not exists idx_word_progress_student_word
  on public.word_progress(student_id, word);

create index if not exists idx_word_progress_student_word_id
  on public.word_progress(student_id, word_id);

create index if not exists idx_word_progress_student_next_review_at
  on public.word_progress(student_id, next_review_at);

create index if not exists idx_word_progress_student_lifecycle_state
  on public.word_progress(student_id, lifecycle_state);

create index if not exists idx_review_queue_student_status_scheduled
  on public.review_queue(student_id, status, scheduled_for);

create index if not exists idx_review_queue_student_word
  on public.review_queue(student_id, word_id);

create index if not exists idx_review_queue_source_attempt_id
  on public.review_queue(source_attempt_id);

drop trigger if exists trg_word_progress_set_updated_at on public.word_progress;
create trigger trg_word_progress_set_updated_at
before update on public.word_progress
for each row
execute function public.set_updated_at();

drop trigger if exists trg_review_queue_set_updated_at on public.review_queue;
create trigger trg_review_queue_set_updated_at
before update on public.review_queue
for each row
execute function public.set_updated_at();

comment on table public.exercise_attempts is
  'Normalized vocab exercise attempt history. These rows should feed word_progress updates and future adaptive models.';

comment on table public.word_progress is
  'Per-student word lifecycle and scheduling state. Derived from exercise_attempts and used to populate review_queue.';

comment on table public.review_queue is
  'Pending scheduled vocab reviews generated from word_progress and recent exercise_attempts.';
