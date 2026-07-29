alter table public.generated_passages
  add column if not exists analysis_main_idea text,
  add column if not exists analysis_structure text,
  add column if not exists analysis_inference_points text[] not null default '{}';
