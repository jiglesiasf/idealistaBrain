-- Radars de zona: add radar columns to saved_searches
alter table public.saved_searches
  add column if not exists is_radar boolean not null default false,
  add column if not exists location_name text,
  add column if not exists location_type text check (location_type in ('district', 'neighborhood', 'municipality', 'area')),
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists last_scan_at timestamptz,
  add column if not exists scan_count integer not null default 0,
  add column if not exists last_scan_status text check (last_scan_status in ('idle', 'scanning', 'completed', 'failed'));

create index if not exists saved_searches_radar_user_id_idx
  on public.saved_searches (user_id, is_radar) where is_radar = true;

create table if not exists public.radar_listings (
  id uuid primary key default gen_random_uuid(),
  radar_id uuid not null references public.saved_searches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text,
  listing_url text not null,
  title text,
  price_eur integer,
  sqmeters numeric(7,1),
  bedrooms integer,
  bathrooms integer,
  source text not null default 'scan' check (source in ('scan', 'alert')),
  alert_event_id uuid references public.search_alert_events(id) on delete set null,
  is_new boolean not null default true,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists radar_listings_radar_id_idx
  on public.radar_listings (radar_id, first_seen_at desc);

create index if not exists radar_listings_user_id_idx
  on public.radar_listings (user_id, first_seen_at desc);

create unique index if not exists radar_listings_unique_per_radar
  on public.radar_listings (radar_id, listing_url);

alter table public.radar_listings
  add column if not exists estimated_rent_eur integer,
  add column if not exists cash_on_cash_roi numeric(5,4),
  add column if not exists cash_on_cash_net_roi numeric(5,4),
  add column if not exists gross_roi numeric(5,4),
  add column if not exists net_roi numeric(5,4);

alter table public.saved_searches enable row level security;
alter table public.radar_listings enable row level security;

create policy "radar_listings_select_own"
on public.radar_listings
for select
to authenticated
using (auth.uid() = user_id);

create policy "radar_listings_insert_own"
on public.radar_listings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "radar_listings_delete_own"
on public.radar_listings
for delete
to authenticated
using (auth.uid() = user_id);

create policy "saved_searches_delete_own"
on public.saved_searches
for delete
to authenticated
using (auth.uid() = user_id);

-- Link jobs to radars for result processing
alter table public.jobs add column if not exists radar_id uuid
  references public.saved_searches(id) on delete set null;

create index if not exists jobs_radar_id_idx
  on public.jobs (radar_id);
