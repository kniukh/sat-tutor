alter table public.vocabulary_dictionary_cache
  add column if not exists canonical_lemma text,
  add column if not exists source_language text not null default 'en',
  add column if not exists content_profile text not null default 'sat_core_v1',
  add column if not exists alternate_definitions text[] not null default '{}'::text[],
  add column if not exists synonym_candidates text[] not null default '{}'::text[],
  add column if not exists antonym_candidates text[] not null default '{}'::text[],
  add column if not exists example_sentences text[] not null default '{}'::text[],
  add column if not exists collocations text[] not null default '{}'::text[],
  add column if not exists confusion_pairs text[] not null default '{}'::text[],
  add column if not exists drill_ingredients jsonb not null default '{}'::jsonb,
  add column if not exists generation_version integer not null default 1,
  add column if not exists prompt_version text not null default 'legacy_v1',
  add column if not exists generation_model text null,
  add column if not exists refreshed_at timestamptz not null default now(),
  add column if not exists quality_score numeric null;

alter table public.vocabulary_item_details
  add column if not exists global_content_id uuid null references public.vocabulary_dictionary_cache(id) on delete set null;

update public.vocabulary_dictionary_cache
set canonical_lemma = coalesce(
  nullif(trim(canonical_lemma), ''),
  nullif(trim(normalized_item_text), '')
)
where canonical_lemma is null
   or trim(canonical_lemma) = '';

update public.vocabulary_dictionary_cache
set example_sentences = case
  when coalesce(array_length(example_sentences, 1), 0) > 0 then example_sentences
  when example_text is not null and trim(example_text) <> '' then array[example_text]
  else '{}'::text[]
end,
refreshed_at = coalesce(refreshed_at, updated_at, created_at);

drop index if exists idx_vocabulary_dictionary_cache_unique_key;

create unique index if not exists idx_vocabulary_dictionary_cache_profile_key
  on public.vocabulary_dictionary_cache (
    canonical_lemma,
    item_type,
    source_language,
    translation_language,
    content_profile
  );

create index if not exists idx_vocabulary_dictionary_cache_lookup_lemma
  on public.vocabulary_dictionary_cache (
    canonical_lemma,
    item_type,
    translation_language,
    content_profile
  );

create index if not exists idx_vocabulary_item_details_global_content_id
  on public.vocabulary_item_details (global_content_id);

update public.vocabulary_item_details as details
set global_content_id = cache.id
from public.vocabulary_dictionary_cache as cache
where details.global_content_id is null
  and coalesce(nullif(trim(details.canonical_lemma), ''), lower(regexp_replace(trim(details.item_text), '\s+', ' ', 'g'))) = cache.canonical_lemma
  and coalesce(details.item_type, 'word') = cache.item_type
  and coalesce(nullif(trim(details.translation_language), ''), 'ru') = cache.translation_language
  and cache.source_language = 'en'
  and cache.content_profile = 'sat_core_v1';

comment on column public.vocabulary_dictionary_cache.canonical_lemma is
  'Reusable global key for shared vocabulary content across students.';

comment on column public.vocabulary_dictionary_cache.content_profile is
  'Shared enrichment profile/version used for reusable drill content generation.';

comment on column public.vocabulary_item_details.global_content_id is
  'Optional reference to the shared reusable vocabulary content row used by this student-specific item.';
