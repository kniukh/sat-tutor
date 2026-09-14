create table if not exists public.reading_assignment_vocabulary (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.reading_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  vocabulary_item_id uuid not null references public.vocabulary_item_details(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  canonical_lemma text not null,
  word text not null,
  source_chunk_index integer,
  selection_score numeric not null default 0,
  is_core boolean not null default true,
  introduced_at timestamptz,
  introduced_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, canonical_lemma)
);

create index if not exists idx_reading_assignment_vocabulary_assignment
  on public.reading_assignment_vocabulary(assignment_id, is_core, introduced_at);

create index if not exists idx_reading_assignment_vocabulary_student
  on public.reading_assignment_vocabulary(student_id, introduced_at);

create index if not exists idx_reading_assignment_vocabulary_word
  on public.reading_assignment_vocabulary(vocabulary_item_id);

drop trigger if exists trg_reading_assignment_vocabulary_set_updated_at
  on public.reading_assignment_vocabulary;

create trigger trg_reading_assignment_vocabulary_set_updated_at
before update on public.reading_assignment_vocabulary
for each row
execute function public.set_updated_at();

comment on table public.reading_assignment_vocabulary is
  'Bounded core vocabulary plan for a student chapter assignment. Only these words can gate chapter completion.';

comment on column public.reading_assignment_vocabulary.introduced_at is
  'First completed Vocabulary Drill exposure for this assignment word. Correctness is tracked separately in word_progress.';
