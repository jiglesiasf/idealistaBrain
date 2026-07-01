create extension if not exists pgcrypto;

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_url text not null,
  listing_id text,
  title text,
  price_eur integer,
  estimated_rent_eur integer,
  total_cash_needed_eur integer,
  sqmeters numeric(7,1),
  bedrooms integer,
  bathrooms integer,
  cash_on_cash_roi numeric(5,4),
  cash_on_cash_net_roi numeric(5,4),
  gross_roi numeric(5,4),
  net_roi numeric(5,4),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  source text not null default 'manual' check (source in ('manual', 'analysis')),
  source_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, listing_url)
);

create trigger set_opportunities_updated_at
before update on public.opportunities
for each row
execute function public.set_updated_at();

create index if not exists opportunities_user_id_created_at_idx
  on public.opportunities (user_id, created_at desc);

create index if not exists opportunities_user_id_status_idx
  on public.opportunities (user_id, status);

alter table public.opportunities enable row level security;

create policy "opportunities_select_own"
on public.opportunities
for select
to authenticated
using (auth.uid() = user_id);

create policy "opportunities_insert_own"
on public.opportunities
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "opportunities_update_own"
on public.opportunities
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "opportunities_delete_own"
on public.opportunities
for delete
to authenticated
using (auth.uid() = user_id);
