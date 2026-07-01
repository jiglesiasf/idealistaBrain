-- Referencia de precio de compraventa por provincia (Registradores de la Propiedad)
-- Fuente: opendata.registradores.org — Estadística Registral Inmobiliaria (ERI)

create extension if not exists unaccent;

create table if not exists public.registradores_sale_reference (
  id                 bigserial primary key,
  cod_provincia      char(2)        not null,
  provincia_nombre   text           not null,
  ccaa_nombre        text           not null,
  anio               smallint       not null,
  precio_m2_vivienda numeric(8,2),
  num_transacciones  integer,
  fuente             text           not null default 'Registradores-ERI',
  fecha_carga        timestamptz    not null default now(),
  constraint registradores_sale_reference_uniq unique (cod_provincia, anio)
);

-- Índices de búsqueda
create index if not exists registradores_sale_ref_prov_lower
  on public.registradores_sale_reference (lower(unaccent(provincia_nombre)));

create index if not exists registradores_sale_ref_cod_anio
  on public.registradores_sale_reference (cod_provincia, anio);

-- RLS
alter table public.registradores_sale_reference enable row level security;

create policy "Usuarios autenticados pueden leer referencias de venta"
  on public.registradores_sale_reference
  for select
  to authenticated
  using (true);

comment on table public.registradores_sale_reference is
  'Precio medio €/m² de compraventa de vivienda libre por provincia y año. '
  'Fuente: Estadística Registral Inmobiliaria (ERI) del Colegio de Registradores. '
  'Se usa para detectar el sesgo de oferta al comparar con el precio publicado en Idealista.';
