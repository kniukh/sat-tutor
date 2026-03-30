alter table public.vocabulary_item_details
  add column if not exists drill_answer_sets jsonb not null default '{}'::jsonb;
