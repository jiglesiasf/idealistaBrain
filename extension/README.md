# Idealista Brain Extension

Primera version de una extension de Chrome para montar el cerebro de la herramienta sobre la ficha real de Idealista, no sobre datos indexados.

## Que hace ahora

- Se inyecta en `idealista.com`
- Lee la ficha actual desde el DOM real
- Puede recibir jobs lanzados desde la web mediante `chrome.runtime.onMessageExternal`
- Ejecuta esos jobs en segundo plano sobre la sesion real del navegador
- Reporta progreso y resultado al backend web con un `executionToken` efimero
- Intenta extraer:
  - id del inmueble
  - URL canonica
  - titulo real
  - breadcrumbs
  - ubicacion normalizada
  - coordenadas si aparecen en JSON-LD
  - links internos utiles detectados en la ficha
- Genera guardrails geograficos:
  - mismo municipio
  - distrito y barrio preferentes
  - provincia solo como contexto auxiliar cuando este disponible
- Construye un `targetAsset` normalizado para el MVP:
  - operacion
  - tipologia
  - precio
  - m2
  - habitaciones
  - banos
  - zona
  - municipio
  - provincia
- Construye el plan de busqueda:
  - primero misma zona
  - despues mismo municipio
  - seguir recogiendo comparables dentro de ambos scopes
  - nunca salir del municipio
- Calcula rentabilidad compartida con:
  - ROI cash to cash
  - ROI cash to cash neto
  - ROI bruto
  - ROI neto

## Arquitectura

### `manifest.json`

Define la extension en Manifest V3:

- `action`: popup de la extension
- `background.service_worker`: orquestacion
- `externally_connectable`: permite que la web le envie jobs
- `content_scripts`: lectura de la pagina real
- `storage`: persistencia ligera del ultimo analisis

### `content-script.js`

Corre dentro de Idealista y extrae la materia prima real de la ficha.

### `core/domain-core.js`

Es la copia sincronizada del core compartido de negocio.

Fuente canonica:
- [src/core/domain-core.cjs](/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/src/core/domain-core.cjs)

### `background.js`

Hace de coordinador:

- localiza la pestaña activa
- pide al content script que analice la ficha
- guarda el ultimo resultado
- acepta jobs remotos `listing-analysis` y `zone-scan`
- abre pestañas temporales de Idealista
- publica `accepted`, `progress`, `completed` y `failed` contra la web

### `popup.html`, `popup.js`, `popup.css`

Interfaz minima para:

- lanzar el analisis
- ver la ubicacion resuelta
- revisar los guardrails
- copiar el JSON

## Como cargarla en Chrome

1. Abre Chrome.
2. Ve a `chrome://extensions`.
3. Activa `Modo desarrollador`.
4. Pulsa `Cargar descomprimida`.
5. Selecciona esta carpeta:

```text
/Users/jiglesias/Documents/Codex/2026-05-10/idealista-brain/extension
```

6. Abre una ficha real de Idealista, por ejemplo:

```text
https://www.idealista.com/inmueble/110808118/
```

7. Pulsa el icono de la extension y revisa el analisis.

Si cambias el core compartido, sincroniza antes de recargar la extension:

```bash
npm run sync:core
```

## Companion bridge con la web

En desarrollo local, la extension acepta mensajes desde:

- `http://localhost/*`
- `http://127.0.0.1/*`
- `https://localhost/*`
- `https://127.0.0.1/*`

Eso vive en `manifest.json` dentro de `externally_connectable.matches`.

La web le envia un job con este tipo:

```json
{
  "type": "IDEALISTA_BRAIN_EXECUTE_JOB",
  "payload": {
    "jobId": "job_123",
    "jobType": "listing-analysis",
    "targetUrl": "https://www.idealista.com/inmueble/123456789/",
    "executionToken": "opaque-token",
    "backendBaseUrl": "http://localhost:3000",
    "apiBasePath": "/api/companion"
  }
}
```

Antes de publicar la web en produccion, habra que añadir el dominio real tanto en:

- `externally_connectable.matches`
- `host_permissions`

## Que falta para el cerebro completo

La siguiente iteracion ya deberia hacer esto:

1. Extraer la geografia real del anuncio origen.
2. Navegar dentro de la misma sesion real de tu navegador.
3. Abrir resultados de alquiler.
4. Verificar cada candidato en vivo.
5. Rechazar:
   - 404
   - venta en vez de alquiler
   - municipio distinto
6. Devolver solo candidatos validados.

## Idea importante

El orden correcto es:

`ficha real -> geografia fiable -> guardrails -> candidatos -> verificacion final`

No al reves.
