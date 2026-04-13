alter table public.vocabulary_item_details
  add column if not exists is_removed boolean not null default false,
  add column if not exists removed_at timestamptz,
  add column if not exists student_definition_override text,
  add column if not exists student_translation_override text,
  add column if not exists definition_override_generated_from_context boolean not null default false,
  add column if not exists definition_override_updated_at timestamptz;

create index if not exists idx_vocabulary_item_details_student_active_created_at
  on public.vocabulary_item_details (student_id, is_removed, created_at desc);

comment on column public.vocabulary_item_details.is_removed is
  'Student-specific soft delete flag. Removes the word from active student vocabulary without deleting shared/global content.';

comment on column public.vocabulary_item_details.student_definition_override is
  'Student-specific definition override, typically regenerated from lesson context. Does not overwrite shared reusable content.';

comment on column public.vocabulary_item_details.student_translation_override is
  'Student-specific translation override paired with the student definition override when context regeneration is used.';

comment on column public.vocabulary_item_details.definition_override_generated_from_context is
  'True when the current student override was generated from a local lesson/question/answer context.';
