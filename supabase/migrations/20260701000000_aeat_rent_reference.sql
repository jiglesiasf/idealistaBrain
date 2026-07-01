-- Tabla de referencia AEAT: precios y rentabilidad de alquiler por municipio
-- Fuente: "Estadística de viviendas declaradas en el IRPF" (AEAT, publicación anual julio)
-- Cobertura: municipios > 20.000 hab. | Régimen Común (excluye PV y Navarra)
-- Años disponibles: 2023+ (rentabilidad_bruta_pct es novedad de 2023)

create extension if not exists unaccent;

create table if not exists public.aeat_rent_reference (
  id                        bigserial primary key,

  ine_municipio_code        char(5)        not null,
  municipio_nombre          text           not null,
  provincia_nombre          text           not null,
  ccaa_nombre               text           not null,
  codigo_postal             char(5),

  anio                      smallint       not null,
  tipo_uso                  text           not null default 'vivienda_habitual'
                              check (tipo_uso in ('vivienda_habitual', 'total')),

  num_viviendas_catastro     integer,
  num_viviendas_arrendadas   integer,
  pct_viviendas_arrendadas   numeric(5,2),

  alquiler_medio_mensual     numeric(8,2),
  alquiler_m2_mensual        numeric(6,2),
  m2_medios                  numeric(6,1),
  dias_alquiler_medios       smallint,

  valor_referencia_medio     numeric(12,2),
  rentabilidad_bruta_pct     numeric(5,2),

  fuente                    text           default 'AEAT-irpfvivienda',
  fecha_carga               timestamptz    default now(),

  unique (ine_municipio_code, anio, tipo_uso)
);

create index if not exists idx_aeat_rent_municipio_anio
  on public.aeat_rent_reference (lower(unaccent(municipio_nombre)), anio);

create index if not exists idx_aeat_rent_provincia_anio
  on public.aeat_rent_reference (lower(unaccent(provincia_nombre)), anio);

create index if not exists idx_aeat_rent_ine_anio
  on public.aeat_rent_reference (ine_municipio_code, anio);

alter table public.aeat_rent_reference enable row level security;

-- Cualquier usuario autenticado puede leer; solo service_role puede escribir
create policy "aeat_rent_reference_select_authenticated"
  on public.aeat_rent_reference
  for select
  to authenticated
  using (true);
