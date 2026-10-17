-- Revoke execute on search RPCs from anon and public to prevent unauthorized
-- calls and avoid 42501 errors on reference_chunks.
-- Only authenticated users (RLS-filtered) and service_role (trusted backend) can execute.

revoke execute on function public.hybrid_search(
  text,
  extensions.halfvec,
  integer,
  jsonb,
  double precision,
  double precision,
  integer
) from public, anon;

grant execute on function public.hybrid_search(
  text,
  extensions.halfvec,
  integer,
  jsonb,
  double precision,
  double precision,
  integer
) to authenticated, service_role;

revoke execute on function public.match_documents(
  extensions.halfvec,
  integer,
  jsonb
) from public, anon;

grant execute on function public.match_documents(
  extensions.halfvec,
  integer,
  jsonb
) to authenticated, service_role;
