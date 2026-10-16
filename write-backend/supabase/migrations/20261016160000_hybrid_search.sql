-- Keyword + semantic retrieval over reference_chunks.
-- Reciprocal rank fusion of english full-text search and halfvec cosine
-- search. Owner and metadata filters run inside each arm so they apply
-- before the rank limit. Returns the same row shape as match_documents.

alter table public.reference_chunks
  add column if not exists fts tsvector
  generated always as (
    to_tsvector('english', coalesce(content, ''))
  ) stored;

create index if not exists reference_chunks_fts_gin_idx
  on public.reference_chunks
  using gin (fts);

create or replace function public.hybrid_search(
  query_text text,
  query_embedding extensions.halfvec,
  match_count integer default 8,
  filter jsonb default '{}'::jsonb,
  full_text_weight double precision default 1,
  semantic_weight double precision default 1,
  rrf_k integer default 50
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
set search_path to ''
as $$
  with params as (
    select
      websearch_to_tsquery('english', coalesce(query_text, '')) as tsq,
      least(coalesce(match_count, 8), 50) as lim
  ),
  full_text as (
    select
      c.id,
      row_number() over (
        order by ts_rank_cd(c.fts, params.tsq) desc
      ) as rank_ix
    from public.reference_chunks as c
    cross join params
    where
      params.tsq <> ''::tsquery
      and c.fts @@ params.tsq
      and (
        not (coalesce(filter, '{}'::jsonb) ? 'owner_id')
        or c.owner_id = (filter->>'owner_id')::uuid
      )
      and c.metadata @> coalesce(filter - 'owner_id', '{}'::jsonb)
    order by rank_ix
    limit (select lim from params) * 2
  ),
  semantic as (
    select
      c.id,
      row_number() over (
        order by c.embedding operator(extensions.<=>) query_embedding
      ) as rank_ix
    from public.reference_chunks as c
    where
      (
        not (coalesce(filter, '{}'::jsonb) ? 'owner_id')
        or c.owner_id = (filter->>'owner_id')::uuid
      )
      and c.metadata @> coalesce(filter - 'owner_id', '{}'::jsonb)
    order by c.embedding operator(extensions.<=>) query_embedding
    limit (select lim from params) * 2
  )
  select
    c.id,
    c.content,
    jsonb_build_object(
      'document_id', c.document_id,
      'name', d.name,
      'chunk_index', c.chunk_index
    ) || coalesce(c.metadata, '{}'::jsonb) as metadata,
    (
      coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight
      + coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
    )::float as similarity
  from full_text
  full outer join semantic
    on full_text.id = semantic.id
  join public.reference_chunks as c
    on c.id = coalesce(full_text.id, semantic.id)
  join public.reference_documents as d
    on d.id = c.document_id
  order by similarity desc
  limit least(coalesce(match_count, 8), 50);
$$;

grant execute on function public.hybrid_search(
  text,
  extensions.halfvec,
  integer,
  jsonb,
  double precision,
  double precision,
  integer
) to anon, authenticated, service_role;
