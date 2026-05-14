const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

function formatSearchNumber(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function extractWordNumber(token: string) {
  const normalized = token.trim().toLowerCase();
  return NUMBER_WORDS[normalized] ?? null;
}

export function parseIdealistaSearchPills(searchUrl: string | null, limit = 6) {
  if (!searchUrl) {
    return [];
  }

  let url: URL;

  try {
    url = new URL(searchUrl);
  } catch {
    return [];
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const filterChunk = parts.find((part) => part.startsWith("con-")) || "";
  const tokens = filterChunk
    .replace(/^con-/, "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const pills: string[] = [];
  const priceMinToken = tokens.find((token) => token.startsWith("precio-desde_"));
  const priceMaxToken = tokens.find((token) => token.startsWith("precio-hasta_"));
  const areaMinToken = tokens.find((token) => token.startsWith("metros-cuadrados-mas-de_"));
  const areaMaxToken = tokens.find((token) => token.startsWith("metros-cuadrados-menos-de_"));

  const priceMin = priceMinToken ? Number.parseInt(priceMinToken.split("_")[1] || "", 10) : null;
  const priceMax = priceMaxToken ? Number.parseInt(priceMaxToken.split("_")[1] || "", 10) : null;
  const areaMin = areaMinToken ? Number.parseInt(areaMinToken.split("_")[1] || "", 10) : null;
  const areaMax = areaMaxToken ? Number.parseInt(areaMaxToken.split("_")[1] || "", 10) : null;

  if (Number.isFinite(priceMin) && Number.isFinite(priceMax)) {
    pills.push(`${formatSearchNumber(priceMin!)}€ - ${formatSearchNumber(priceMax!)}€`);
  } else if (Number.isFinite(priceMin)) {
    pills.push(`Desde ${formatSearchNumber(priceMin!)}€`);
  } else if (Number.isFinite(priceMax)) {
    pills.push(`Hasta ${formatSearchNumber(priceMax!)}€`);
  }

  if (Number.isFinite(areaMin) && Number.isFinite(areaMax)) {
    pills.push(`${areaMin} - ${areaMax} m²`);
  } else if (Number.isFinite(areaMin)) {
    pills.push(`Más de ${areaMin} m²`);
  } else if (Number.isFinite(areaMax)) {
    pills.push(`Hasta ${areaMax} m²`);
  }

  const bedroomValues = tokens
    .map((token) => token.match(/^de-([a-z]+)-dormitorios$/)?.[1] || null)
    .map((word) => (word ? extractWordNumber(word) : null))
    .filter((value): value is number => Number.isFinite(value));

  if (bedroomValues.length > 0) {
    const minBedrooms = Math.min(...bedroomValues);
    const maxBedrooms = Math.max(...bedroomValues);
    pills.push(minBedrooms === maxBedrooms ? `${minBedrooms} hab.` : `${minBedrooms}-${maxBedrooms} hab.`);
  }

  const bathroomValues = tokens
    .map((token) => token.match(/^([a-z]+)-banos?$/)?.[1] || null)
    .map((word) => (word ? extractWordNumber(word) : null))
    .filter((value): value is number => Number.isFinite(value));

  if (bathroomValues.length > 0) {
    const minBathrooms = Math.min(...bathroomValues);
    const maxBathrooms = Math.max(...bathroomValues);
    pills.push(minBathrooms === maxBathrooms ? `${minBathrooms} baño${minBathrooms > 1 ? "s" : ""}` : `${minBathrooms}-${maxBathrooms} baños`);
  }

  if (tokens.includes("solo-pisos")) {
    pills.push("Solo pisos");
  }

  if (tokens.includes("solo-casas")) {
    pills.push("Solo casas");
  }

  const sort = url.searchParams.get("ordenado-por");
  if (sort === "fecha-publicacion-desc") {
    pills.push("Más recientes");
  }

  return pills.slice(0, limit);
}
