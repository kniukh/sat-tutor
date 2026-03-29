create table if not exists public.lesson_reading_metrics (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  reading_duration_sec integer not null check (reading_duration_sec >= 0),
  words_count integer not null check (words_count >= 0),
  words_per_minute numeric(10, 2) not null check (words_per_minute >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_reading_metrics_student_lesson
  on public.lesson_reading_metrics(student_id, lesson_id);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  selected_option text not null,
  is_correct boolean not null,
  duration_sec integer not null check (duration_sec >= 0),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_question_attempts_student_lesson
  on public.question_attempts(student_id, lesson_id);

create index if not exists idx_question_attempts_question
  on public.question_attempts(question_id);
