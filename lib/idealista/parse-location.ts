const LOCATION_HIERARCHY: Record<string, string> = {
  provincia: "province",
  zona: "area",
  barrio: "neighborhood",
  distrito: "district",
  municipio: "municipality",
};

export type ParsedLocation = {
  name: string;
  shortName: string;
  type: "district" | "neighborhood" | "municipality" | "area";
  segments: string[];
};

function capitalizeName(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseIdealistaLocation(searchUrl: string): ParsedLocation | null {
  if (!searchUrl) return null;

  let url: URL;
  try {
    url = new URL(searchUrl);
  } catch {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);

  const saleIndex = parts.findIndex(
    (p) => p === "venta-viviendas" || p === "alquiler-viviendas" || p === "venta-oficinas"
  );

  if (saleIndex === -1) return null;

  const locationSegments = parts.slice(saleIndex + 1).filter((seg) => !seg.startsWith("con-"));

  if (locationSegments.length === 0) return null;

  const rawSegments = [...locationSegments];
  const lastSegment = locationSegments[locationSegments.length - 1]!;

  let type: "district" | "neighborhood" | "municipality" | "area";

  const knownType = LOCATION_HIERARCHY[lastSegment];

  if (knownType === "neighborhood" || locationSegments.length >= 3) {
    type = "neighborhood";
  } else if (knownType === "district" || locationSegments.length >= 2) {
    type = "district";
  } else if (knownType === "area") {
    type = "area";
  } else {
    type = "municipality";
  }

  const fullName = locationSegments.map(capitalizeName).join(" · ");

  const shortName = capitalizeName(locationSegments[locationSegments.length - 1]!);

  return {
    name: fullName,
    shortName,
    type,
    segments: rawSegments,
  };
}

export function parseIdealistaLocationFromPath(pathname: string): ParsedLocation | null {
  if (!pathname) return null;

  let url: URL;
  try {
    url = new URL(`https://www.idealista.com${pathname.startsWith("/") ? "" : "/"}${pathname}`);
  } catch {
    return null;
  }

  return parseIdealistaLocation(url.href);
}

export function extractRadarName(location: ParsedLocation, pills: string[]): string {
  const filterParts = pills.length > 0 ? ` · ${pills.join(", ")}` : "";
  return `${location.shortName}${filterParts}`;
}
