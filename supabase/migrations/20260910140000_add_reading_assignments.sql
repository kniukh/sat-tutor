create table if not exists public.reading_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  assigned_by text,
  status text not null default 'assigned' check (status in ('assigned', 'completed', 'archived')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(student_id, source_document_id)
);

create index if not exists idx_reading_assignments_student_status
  on public.reading_assignments(student_id, status, assigned_at desc);

create index if not exists idx_reading_assignments_source
  on public.reading_assignments(source_document_id, status);

comment on table public.reading_assignments is
  'Admin-created book assignments for student reading paths, including SAT and DET content.';
