create table if not exists public.vocabulary_dictionary_cache (
  id uuid primary key default gen_random_uuid(),
  normalized_item_text text not null,
  item_text text not null,
  item_type text not null,
  translation_language text not null default 'ru',
  english_explanation text not null,
  translated_explanation text not null,
  example_text text null,
  distractors text[] not null default '{}'::text[],
  drill_answer_sets jsonb not null default '{}'::jsonb,
  source_quality text not null default 'ai_generated',
  usage_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_dictionary_cache_item_type_check
    check (item_type in ('word', 'phrase')),
  constraint vocabulary_dictionary_cache_source_quality_check
    check (source_quality in ('ai_generated', 'human_reviewed')),
  constraint vocabulary_dictionary_cache_usage_count_check
    check (usage_count >= 0)
);

create unique index if not exists idx_vocabulary_dictionary_cache_unique_key
  on public.vocabulary_dictionary_cache (
    normalized_item_text,
    item_type,
    translation_language
  );

create index if not exists idx_vocabulary_dictionary_cache_last_used_at
  on public.vocabulary_dictionary_cache (last_used_at desc);

drop trigger if exists trg_vocabulary_dictionary_cache_set_updated_at
  on public.vocabulary_dictionary_cache;

create trigger trg_vocabulary_dictionary_cache_set_updated_at
before update on public.vocabulary_dictionary_cache
for each row
execute function public.set_updated_at();

alter table public.vocabulary_dictionary_cache
  enable row level security;

comment on table public.vocabulary_dictionary_cache is
  'Shared cross-student dictionary cache for reusable vocabulary meanings, translations, and drill answer sets.';
