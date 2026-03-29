create table if not exists public.mistake_analysis (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  question_type text,
  mistake_type text not null,
  confidence numeric,
  short_reason text,
  coaching_tip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mistake_analysis_student_id
  on public.mistake_analysis(student_id);

create index if not exists idx_mistake_analysis_lesson_id
  on public.mistake_analysis(lesson_id);

create index if not exists idx_mistake_analysis_question_id
  on public.mistake_analysis(question_id);
