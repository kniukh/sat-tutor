alter table public.vocabulary_dictionary_cache
  add column if not exists core_meaning text,
  add column if not exists definition text,
  add column if not exists translation_word text,
  add column if not exists translation_meaning text,
  add column if not exists synonyms text[] not null default '{}'::text[],
  add column if not exists antonyms text[] not null default '{}'::text[],
  add column if not exists example_sentence text,
  add column if not exists example_translation text,
  add column if not exists audio_text text,
  add column if not exists part_of_speech text;

alter table public.vocabulary_item_details
  add column if not exists core_meaning text,
  add column if not exists definition text,
  add column if not exists translation_word text,
  add column if not exists translation_meaning text,
  add column if not exists synonyms text[] not null default '{}'::text[],
  add column if not exists antonyms text[] not null default '{}'::text[],
  add column if not exists example_sentence text,
  add column if not exists example_translation text,
  add column if not exists audio_text text,
  add column if not exists part_of_speech text;

update public.vocabulary_dictionary_cache
set
  core_meaning = coalesce(
    nullif(trim(core_meaning), ''),
    nullif(trim(english_explanation), '')
  ),
  definition = coalesce(
    nullif(trim(definition), ''),
    nullif(trim(english_explanation), '')
  ),
  translation_meaning = coalesce(
    nullif(trim(translation_meaning), ''),
    nullif(trim(translated_explanation), '')
  ),
  synonyms = case
    when coalesce(array_length(synonyms, 1), 0) > 0 then synonyms
    when coalesce(array_length(synonym_candidates, 1), 0) > 0 then synonym_candidates
    else '{}'::text[]
  end,
  antonyms = case
    when coalesce(array_length(antonyms, 1), 0) > 0 then antonyms
    when coalesce(array_length(antonym_candidates, 1), 0) > 0 then antonym_candidates
    else '{}'::text[]
  end,
  example_sentence = coalesce(
    nullif(trim(example_sentence), ''),
    nullif(trim(example_text), ''),
    nullif(example_sentences[1], '')
  ),
  audio_text = coalesce(
    nullif(trim(audio_text), ''),
    nullif(trim(item_text), '')
  ),
  part_of_speech = coalesce(
    nullif(trim(part_of_speech), ''),
    case when item_type = 'phrase' then 'phrase' else null end
  );

update public.vocabulary_item_details
set
  core_meaning = coalesce(
    nullif(trim(core_meaning), ''),
    nullif(trim(english_explanation), '')
  ),
  definition = coalesce(
    nullif(trim(definition), ''),
    nullif(trim(english_explanation), '')
  ),
  translation_meaning = coalesce(
    nullif(trim(translation_meaning), ''),
    nullif(trim(translated_explanation), '')
  ),
  example_sentence = coalesce(
    nullif(trim(example_sentence), ''),
    nullif(trim(example_text), ''),
    nullif(trim(context_sentence), '')
  ),
  audio_text = coalesce(
    nullif(trim(audio_text), ''),
    nullif(trim(item_text), '')
  ),
  part_of_speech = coalesce(
    nullif(trim(part_of_speech), ''),
    case when item_type = 'phrase' then 'phrase' else null end
  );

update public.vocabulary_item_details as details
set
  core_meaning = coalesce(nullif(trim(details.core_meaning), ''), cache.core_meaning),
  definition = coalesce(nullif(trim(details.definition), ''), cache.definition),
  translation_word = coalesce(nullif(trim(details.translation_word), ''), cache.translation_word),
  translation_meaning = coalesce(nullif(trim(details.translation_meaning), ''), cache.translation_meaning),
  synonyms = case
    when coalesce(array_length(details.synonyms, 1), 0) > 0 then details.synonyms
    when coalesce(array_length(cache.synonyms, 1), 0) > 0 then cache.synonyms
    else '{}'::text[]
  end,
  antonyms = case
    when coalesce(array_length(details.antonyms, 1), 0) > 0 then details.antonyms
    when coalesce(array_length(cache.antonyms, 1), 0) > 0 then cache.antonyms
    else '{}'::text[]
  end,
  example_sentence = coalesce(nullif(trim(details.example_sentence), ''), cache.example_sentence),
  example_translation = coalesce(nullif(trim(details.example_translation), ''), cache.example_translation),
  audio_text = coalesce(nullif(trim(details.audio_text), ''), cache.audio_text),
  part_of_speech = coalesce(nullif(trim(details.part_of_speech), ''), cache.part_of_speech)
from public.vocabulary_dictionary_cache as cache
where details.global_content_id = cache.id;

comment on column public.vocabulary_dictionary_cache.core_meaning is
  'Short concise English gloss for drill composition.';
comment on column public.vocabulary_dictionary_cache.definition is
  'Fuller explanatory definition, separate from short core meaning.';
comment on column public.vocabulary_dictionary_cache.translation_word is
  'Short natural translation of the vocabulary item itself.';
comment on column public.vocabulary_dictionary_cache.translation_meaning is
  'Translation of the meaning/definition rather than the lexical item.';
comment on column public.vocabulary_dictionary_cache.example_sentence is
  'Preferred natural example sentence for drills.';
comment on column public.vocabulary_dictionary_cache.example_translation is
  'Translation of the preferred example sentence when available.';
comment on column public.vocabulary_dictionary_cache.audio_text is
  'Exact text intended for TTS/audio matching. Defaults to item_text when not customized.';
comment on column public.vocabulary_dictionary_cache.part_of_speech is
  'Best available part-of-speech label for drill composition.';

comment on column public.vocabulary_item_details.core_meaning is
  'Student-row materialized short gloss, typically hydrated from shared gold content.';
comment on column public.vocabulary_item_details.translation_word is
  'Student-row materialized lexical translation, if available from shared gold content.';
comment on column public.vocabulary_item_details.translation_meaning is
  'Student-row materialized meaning translation, kept separate from translation_word.';
