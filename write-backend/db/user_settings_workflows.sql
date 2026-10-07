-- Split user_settings into a shared model plus Write (generate) and Review (critique).
-- The previous flat columns (temperature, k, max_token, top_p, top_k) were one
-- undifferentiated set. The table had no rows when this ran.

alter table public.user_settings
  drop column if exists temperature,
  drop column if exists k,
  drop column if exists max_token,
  drop column if exists top_p,
  drop column if exists top_k;

alter table public.user_settings
  add column if not exists generate_system_prompt text,
  add column if not exists generate_temperature double precision,
  add column if not exists generate_max_tokens integer,
  add column if not exists generate_top_p double precision,
  add column if not exists generate_frequency_penalty double precision,
  add column if not exists generate_context_chunks integer,
  add column if not exists critique_system_prompt text,
  add column if not exists critique_temperature double precision,
  add column if not exists critique_max_tokens integer,
  add column if not exists critique_top_p double precision,
  add column if not exists critique_frequency_penalty double precision,
  add column if not exists critique_context_chunks integer;

alter table public.user_settings
  drop constraint if exists user_settings_model_name_check,
  add constraint user_settings_model_name_check
    check (
      model_name is null
      or model_name = any (array[
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite'
      ]::text[])
    );

alter table public.user_settings
  drop constraint if exists user_settings_generate_system_prompt_check,
  add constraint user_settings_generate_system_prompt_check
    check (generate_system_prompt is null or char_length(generate_system_prompt) <= 8000),
  drop constraint if exists user_settings_generate_temperature_check,
  add constraint user_settings_generate_temperature_check
    check (generate_temperature is null or generate_temperature between 0 and 1.5),
  drop constraint if exists user_settings_generate_max_tokens_check,
  add constraint user_settings_generate_max_tokens_check
    check (generate_max_tokens is null or generate_max_tokens between 256 and 4096),
  drop constraint if exists user_settings_generate_top_p_check,
  add constraint user_settings_generate_top_p_check
    check (generate_top_p is null or generate_top_p between 0.1 and 1),
  drop constraint if exists user_settings_generate_frequency_penalty_check,
  add constraint user_settings_generate_frequency_penalty_check
    check (
      generate_frequency_penalty is null
      or generate_frequency_penalty between 1 and 1.5
    ),
  drop constraint if exists user_settings_generate_context_chunks_check,
  add constraint user_settings_generate_context_chunks_check
    check (generate_context_chunks is null or generate_context_chunks between 1 and 10);

alter table public.user_settings
  drop constraint if exists user_settings_critique_system_prompt_check,
  add constraint user_settings_critique_system_prompt_check
    check (critique_system_prompt is null or char_length(critique_system_prompt) <= 8000),
  drop constraint if exists user_settings_critique_temperature_check,
  add constraint user_settings_critique_temperature_check
    check (critique_temperature is null or critique_temperature between 0 and 1.5),
  drop constraint if exists user_settings_critique_max_tokens_check,
  add constraint user_settings_critique_max_tokens_check
    check (critique_max_tokens is null or critique_max_tokens between 256 and 4096),
  drop constraint if exists user_settings_critique_top_p_check,
  add constraint user_settings_critique_top_p_check
    check (critique_top_p is null or critique_top_p between 0.1 and 1),
  drop constraint if exists user_settings_critique_frequency_penalty_check,
  add constraint user_settings_critique_frequency_penalty_check
    check (
      critique_frequency_penalty is null
      or critique_frequency_penalty between 1 and 1.5
    ),
  drop constraint if exists user_settings_critique_context_chunks_check,
  add constraint user_settings_critique_context_chunks_check
    check (critique_context_chunks is null or critique_context_chunks between 1 and 10);

comment on table public.user_settings is
  'Per-user chat settings. model_name is shared. generate_* is Write. critique_* is Review.';
