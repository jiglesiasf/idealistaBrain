create or replace function public.is_allowed_pisos_user()
returns boolean as $$
  select auth.uid() in (
    select id from auth.users
    where email in ('jiglesiasf@gmail.com', 'oscar.aragunde@gmail.com')
  );
$$ language sql security definer stable;

create table if not exists public.pisos_interesantes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  title text,
  listing_url text,
  notes text,

  price_eur integer,
  sqmeters numeric(7,1),
  bedrooms integer,
  bathrooms integer,
  property_type text,

  estimated_rent_eur integer,

  itp_rate numeric(5,4),
  notary_registry_eur integer,
  mortgage_fees_eur integer,
  renovation_cost_eur integer,
  purchase_commission_eur integer,
  furniture_other_eur integer,

  loan_to_value numeric(5,4),
  interest_rate numeric(5,4),
  mortgage_term_years integer,

  ibi_basuras_eur integer,
  insurance_eur integer,
  community_eur integer,
  maintenance_eur integer,
  vacancy_months numeric(3,1),

  gross_yield numeric(5,4),
  net_yield numeric(5,4),
  cash_on_cash_roi numeric(5,4),
  cash_on_cash_net_roi numeric(5,4),
  total_cash_needed_eur integer,
  monthly_mortgage_eur integer,
  monthly_net_cash_flow_eur integer
);

create trigger set_pisos_interesantes_updated_at
before update on public.pisos_interesantes
for each row
execute function public.set_updated_at();

create index if not exists pisos_interesantes_created_at_idx
  on public.pisos_interesantes (created_at desc);

alter table public.pisos_interesantes enable row level security;

create policy "pisos_full_access"
on public.pisos_interesantes
for all
to authenticated
using (public.is_allowed_pisos_user())
with check (public.is_allowed_pisos_user());
