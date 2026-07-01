# Idealista Brain

Herramienta **buy-to-rent** que analiza inmuebles de Idealista en vivo mediante una extensión de Chrome, estima su alquiler potencial y calcula la rentabilidad (ROI cash-to-cash, neto, bruto, neto).

## Stack

| Capa | Tecnología |
|------|-----------|
| Web app | Next.js 16 + React 19 |
| Auth + DB | Supabase (Auth, PostgreSQL, RLS) |
| Extensión | Chrome Manifest V3 |
| Tests | Vitest |

## Requisitos

- Node.js 20+
- Chrome (para la extensión)
- Una cuenta de Idealista (para usar la extensión)

## Puesta en marcha

### 1. Pedir credenciales

Este proyecto usa una instancia compartida de Supabase. Necesitas que alguien del equipo te pase este fichero.

**Solicita el archivo `.env.local`** con las siguientes variables:

| Variable | Propósito |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de backend para escritura |
| `NEXT_PUBLIC_COMPANION_EXTENSION_ID` | ID de la extensión Chrome |

Coloca el `.env.local` en la raíz del proyecto.

### 2. Clonar e instalar

```bash
git clone <repo>
cd idealista-brain
npm install
```

### 3. Arrancar

```bash
npm run dev
# Abre http://localhost:3000
```

### 4. Cargar la extensión (opcional, para análisis en vivo)

1. Ve a `chrome://extensions`
2. Activa "Modo desarrollador"
3. "Cargar descomprimida" → selecciona la carpeta `extension/`
4. Abre una ficha de Idealista, abre el popup y prueba

## Uso

### Analizar una vivienda

Pega la URL de Idealista en la web o abre la extensión sobre una ficha.

### Escanear una zona

Abre un listado de resultados en Idealista y usa la extensión → "Escanear zona". La extensión procesa cada inmueble y los rankea por ROI.

### Calculadora

En la web, pestaña "Calculadora" para simulaciones rápidas, ya sea con un listado de idealista o directamente con valores introducidos manualmente.

### Seguimiento de oportunidades

En `Seguimiento` guardas las oportunidades que te interesan para revisarlas después. Puedes añadirlas manualmente o desde la calculadora con el botón "+ Seguimiento" que aparece junto a "Ver en Idealista" cuando importas un análisis.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build producción |
| `npm run start` | Servidor producción |
| `npm run typecheck` | TypeScript check |
| `npm test` | Tests (Vitest) |
| `npm run sync:core` | Sincroniza lógica de dominio a la extensión |

## Troubleshooting

**"Missing Supabase environment variables" aparece en la web**
Te falta `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` o ambas. Revisa que el `.env.local` esté en la raíz del proyecto y que no tenga errores tipográficos.

**La web arranca pero los análisis se quedan bloqueados sin guardar**
Falta `SUPABASE_SERVICE_ROLE_KEY`. Sin ella, la extensión no puede escribir el resultado final contra la API. Pide la clave al equipo.

**La extensión no recibe los jobs lanzados desde la web**
`NEXT_PUBLIC_COMPANION_EXTENSION_ID` está vacío o no coincide con el ID real de la extensión. Saca el ID de `chrome://extensions` (modo desarrollador) y pide que lo actualicen en el `.env.local`.

**La extensión no se conecta a la web en local**
Asegúrate de que la web corre en `http://localhost:3000`. La extensión solo acepta mensajes desde `localhost`, `127.0.0.1` y el dominio de producción. Si cambias de puerto, actualiza `manifest.json`.

**Al cambiar lógica de negocio, la extensión sigue usando la vieja**
Ejecuta `npm run sync:core` y recarga la extensión en `chrome://extensions`.

**`npm run dev` falla porque el puerto 3000 está ocupado**
Ejecuta `npx next dev -p 3001` y ajusta la URL si es necesario.

**Aparece un "notice" amarillo en la web sobre falta de configuración**
Son avisos intencionales. La web funciona parcialmente aunque falten cosas, pero ciertas funciones se desactivan hasta que las variables estén completas.

## Supabase (solo admins)

Si necesitas hacer cambios en la base de datos, hay migraciones en `supabase/migrations/` para ejecutar en el SQL Editor del proyecto Supabase. Ejecútalas en orden cronológico por fecha en el nombre del archivo.
