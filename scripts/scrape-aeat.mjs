/**
 * Scraper del visor jrubik de AEAT para obtener datos de alquiler por municipio.
 *
 * Fuente: "Estadística de viviendas declaradas en el IRPF" (AEAT)
 * URL base: https://sede.agenciatributaria.gob.es/.../irpfvivienda/{AÑO}/
 *
 * Uso:
 *   npx playwright install chromium   # primera vez
 *   node scripts/scrape-aeat.mjs [año]
 *   node scripts/scrape-aeat.mjs 2023  # genera scripts/seed_aeat_2023.sql
 *
 * El SQL generado se puede ejecutar directamente en el SQL editor de Supabase.
 * Cubre ~405 municipios >20.000 hab, régimen común (excluye PV y Navarra).
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// URLs por año — añadir cuando AEAT publique nuevas ediciones (normalmente julio)
const YEAR_URLS = {
  2023: 'https://sede.agenciatributaria.gob.es/AEAT/Contenidos_Comunes/La_Agencia_Tributaria/Estadisticas/Publicaciones/sites/irpfvivienda/2023/jrubik398550fc8595f66d9764a92a177519b0c947b77.html',
};

const CCAAS = new Set([
  'Andalucía','Aragón','Asturias, Principado de','Balears, Illes','Canarias',
  'Cantabria','Castilla y León','Castilla-La Mancha','Cataluña','Comunitat Valenciana',
  'Extremadura','Galicia','Madrid, Comunidad de','Murcia, Región de','Rioja, La',
  'Ceuta','Melilla',
]);

function parseNum(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function esc(s) {
  return s ? s.replace(/'/g, "''") : '';
}

function toSqlValue(x) {
  return (x === null || x === undefined) ? 'NULL' : x;
}

async function scrape(year) {
  const url = YEAR_URLS[year];
  if (!url) {
    console.error(`No hay URL configurada para el año ${year}. Años disponibles: ${Object.keys(YEAR_URLS).join(', ')}`);
    process.exit(1);
  }

  console.log(`Abriendo navegador...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`Navegando a AEAT ${year}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  // Espera a que la tabla esté renderizada
  await page.waitForSelector('table#table01 tbody tr', { timeout: 30000 });

  console.log('Extrayendo datos...');
  const municipios = await page.evaluate((ccaasArray) => {
    const CCAAS = new Set(ccaasArray);
    const rows = Array.from(document.querySelectorAll('table#table01 tbody tr'));
    let currentCCAA = '', currentProvincia = '';
    const result = [];

    for (const tr of rows) {
      const cells = Array.from(tr.querySelectorAll('td,th')).map(td => td.textContent?.trim() || '');
      const loc = cells[0];
      if (!loc || loc === 'Total') continue;

      const m = loc.match(/^(.+)-(\d{5})$/);
      if (m) {
        result.push({
          ine: m[2], nombre: m[1],
          provincia: currentProvincia || currentCCAA,
          ccaa: currentCCAA,
          vc: cells[1], va: cells[2],
          am: cells[3], am2: cells[4],
          m2: cells[5], d: cells[6],
          vr: cells[7], rb: cells[8],
        });
      } else if (CCAAS.has(loc) && loc !== currentCCAA) {
        currentCCAA = loc;
        currentProvincia = '';
      } else {
        currentProvincia = loc;
      }
    }
    return result;
  }, Array.from(CCAAS));

  await browser.close();
  console.log(`Extraídos: ${municipios.length} municipios`);

  // Generar SQL
  const lines = municipios.map(r =>
    `  ('${esc(r.ine)}','${esc(r.nombre)}','${esc(r.provincia)}','${esc(r.ccaa)}',` +
    `${year},'vivienda_habitual',` +
    `${toSqlValue(parseNum(r.vc))},${toSqlValue(parseNum(r.va))},` +
    `${toSqlValue(parseNum(r.am))},${toSqlValue(parseNum(r.am2))},` +
    `${toSqlValue(parseNum(r.m2))},${toSqlValue(parseNum(r.d))},` +
    `${toSqlValue(parseNum(r.vr))},${toSqlValue(parseNum(r.rb))},` +
    `'AEAT-irpfvivienda')`
  );

  const sql = [
    `-- Seed AEAT ${year}: Estadística viviendas declaradas en el IRPF`,
    `-- Fuente: ${url}`,
    `-- Municipios >20.000 hab, vivienda habitual | Generado: ${new Date().toISOString().slice(0,10)}`,
    `-- Total: ${municipios.length} municipios`,
    '',
    `INSERT INTO public.aeat_rent_reference`,
    `  (ine_municipio_code,municipio_nombre,provincia_nombre,ccaa_nombre,anio,tipo_uso,`,
    `   num_viviendas_catastro,num_viviendas_arrendadas,alquiler_medio_mensual,`,
    `   alquiler_m2_mensual,m2_medios,dias_alquiler_medios,valor_referencia_medio,`,
    `   rentabilidad_bruta_pct,fuente)`,
    `VALUES`,
    lines.join(',\n'),
    `ON CONFLICT (ine_municipio_code,anio,tipo_uso) DO UPDATE SET`,
    `  alquiler_medio_mensual   = EXCLUDED.alquiler_medio_mensual,`,
    `  alquiler_m2_mensual      = EXCLUDED.alquiler_m2_mensual,`,
    `  rentabilidad_bruta_pct   = EXCLUDED.rentabilidad_bruta_pct,`,
    `  num_viviendas_arrendadas = EXCLUDED.num_viviendas_arrendadas,`,
    `  valor_referencia_medio   = EXCLUDED.valor_referencia_medio,`,
    `  fecha_carga              = now();`,
    '',
  ].join('\n');

  const outPath = join(__dir, `seed_aeat_${year}.sql`);
  writeFileSync(outPath, sql, 'utf8');
  console.log(`SQL escrito en: ${outPath}`);
  console.log(`Para importar: pega el contenido en el SQL editor de Supabase o usa psql.`);
}

const year = parseInt(process.argv[2] || '2023', 10);
scrape(year).catch(err => { console.error(err); process.exit(1); });
