create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  idealista_search_url text not null,
  idealista_alert_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_saved_searches_updated_at
before update on public.saved_searches
for each row
execute function public.set_updated_at();

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'imap',
  provider_message_id text not null,
  from_address text not null,
  subject text not null,
  received_at timestamptz not null,
  raw_html text,
  raw_text text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'ignored', 'failed')),
  parse_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider, provider_message_id)
);

create trigger set_inbox_messages_updated_at
before update on public.inbox_messages
for each row
execute function public.set_updated_at();

create table if not exists public.search_alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_search_id uuid references public.saved_searches(id) on delete set null,
  inbox_message_id uuid not null references public.inbox_messages(id) on delete cascade,
  event_type text not null check (event_type in ('new-listings', 'price-drops', 'mixed')),
  detected_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.search_alert_listings (
  id uuid primary key default gen_random_uuid(),
  alert_event_id uuid not null references public.search_alert_events(id) on delete cascade,
  listing_id text,
  listing_url text not null,
  title text,
  price_hint_eur integer,
  is_new boolean not null default true,
  is_price_drop boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listing_watch_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  listing_url text not null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_price_seen_eur integer,
  times_seen integer not null default 1 check (times_seen >= 1),
  latest_saved_search_id uuid references public.saved_searches(id) on delete set null,
  latest_alert_event_id uuid references public.search_alert_events(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, listing_id)
);

create trigger set_listing_watch_state_updated_at
before update on public.listing_watch_state
for each row
execute function public.set_updated_at();

create index if not exists saved_searches_user_id_created_at_idx
  on public.saved_searches (user_id, created_at desc);

create index if not exists inbox_messages_user_id_received_at_idx
  on public.inbox_messages (user_id, received_at desc);

create index if not exists inbox_messages_status_idx
  on public.inbox_messages (status, received_at asc);

create index if not exists search_alert_events_user_id_detected_at_idx
  on public.search_alert_events (user_id, detected_at desc);

create index if not exists search_alert_events_saved_search_id_idx
  on public.search_alert_events (saved_search_id, detected_at desc);

create index if not exists search_alert_listings_alert_event_id_idx
  on public.search_alert_listings (alert_event_id, created_at asc);

create index if not exists listing_watch_state_user_id_last_seen_at_idx
  on public.listing_watch_state (user_id, last_seen_at desc);

alter table public.saved_searches enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.search_alert_events enable row level security;
alter table public.search_alert_listings enable row level security;
alter table public.listing_watch_state enable row level security;

create policy "saved_searches_select_own"
on public.saved_searches
for select
to authenticated
using (auth.uid() = user_id);

create policy "saved_searches_insert_own"
on public.saved_searches
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "saved_searches_update_own"
on public.saved_searches
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "inbox_messages_select_own"
on public.inbox_messages
for select
to authenticated
using (auth.uid() = user_id);

create policy "search_alert_events_select_own"
on public.search_alert_events
for select
to authenticated
using (auth.uid() = user_id);

create policy "search_alert_listings_select_via_alert_event"
on public.search_alert_listings
for select
to authenticated
using (
  exists (
    select 1
    from public.search_alert_events
    where public.search_alert_events.id = public.search_alert_listings.alert_event_id
      and public.search_alert_events.user_id = auth.uid()
  )
);

create policy "listing_watch_state_select_own"
on public.listing_watch_state
for select
to authenticated
using (auth.uid() = user_id);
