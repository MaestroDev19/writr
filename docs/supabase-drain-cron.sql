-- Writr: drain background_jobs via Supabase Cron (pg_cron + pg_net).
-- Same pattern as Pantra — avoids Vercel Hobby's once-per-day Cron limit.
--
-- Prerequisites (one-time in SQL editor or via vault UI):
--   select vault.create_secret('YOUR_CRON_SECRET', 'writr_cron_secret');
-- Keep that value identical to CRON_SECRET on the Vercel API project.
--
-- Update the URL below if the production API host changes.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_writr_drain_jobs()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cron_secret text;
begin
  select decrypted_secret
    into cron_secret
  from vault.decrypted_secrets
  where name = 'writr_cron_secret'
  limit 1;

  if cron_secret is null or length(cron_secret) = 0 then
    raise exception 'Missing vault secret: writr_cron_secret';
  end if;

  -- Fire-and-forget GET; pg_net completes asynchronously.
  perform net.http_get(
    url := 'https://writr-green.vercel.app/internal/drain-jobs?limit=5',
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || cron_secret,
      'accept', 'application/json'
    ),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.trigger_writr_drain_jobs() from public;
revoke all on function public.trigger_writr_drain_jobs() from anon, authenticated;
grant execute on function public.trigger_writr_drain_jobs() to postgres;

select cron.unschedule(jobid)
from cron.job
where jobname = 'trigger-writr-drain-jobs';

select cron.schedule(
  'trigger-writr-drain-jobs',
  '* * * * *',
  $$select public.trigger_writr_drain_jobs();$$
);
