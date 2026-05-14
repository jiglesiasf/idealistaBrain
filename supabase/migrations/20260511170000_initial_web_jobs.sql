create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (job_type in ('listing-analysis', 'zone-scan')),
  status text not null default 'queued' check (status in ('queued', 'dispatching', 'running', 'completed', 'failed')),
  target_url text not null,
  progress integer check (progress is null or (progress >= 0 and progress <= 100)),
  last_progress_stage text,
  last_progress_message text,
  result_type text check (result_type is null or result_type in ('listing-analysis', 'zone-scan')),
  execution_token_hash text not null,
  execution_token_expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listing_analyses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zone_scans (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists jobs_user_id_created_at_idx on public.jobs (user_id, created_at desc);
create index if not exists job_events_job_id_created_at_idx on public.job_events (job_id, created_at asc);
create index if not exists listing_analyses_user_id_idx on public.listing_analyses (user_id);
create index if not exists zone_scans_user_id_idx on public.zone_scans (user_id);

alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.listing_analyses enable row level security;
alter table public.zone_scans enable row level security;

create policy "jobs_select_own"
on public.jobs
for select
to authenticated
using (auth.uid() = user_id);

create policy "jobs_insert_own"
on public.jobs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "job_events_select_via_jobs"
on public.job_events
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs
    where public.jobs.id = public.job_events.job_id
      and public.jobs.user_id = auth.uid()
  )
);

create policy "listing_analyses_select_own"
on public.listing_analyses
for select
to authenticated
using (auth.uid() = user_id);

create policy "zone_scans_select_own"
on public.zone_scans
for select
to authenticated
using (auth.uid() = user_id);
