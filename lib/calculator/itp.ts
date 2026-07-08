export const ITP_RATES: Record<string, number> = {
  Andalucía: 0.08,
  Aragón: 0.08,
  Asturias: 0.08,
  Baleares: 0.08,
  Canarias: 0.065,
  Cantabria: 0.10,
  "Castilla - La Mancha": 0.09,
  "Castilla León": 0.08,
  Cataluña: 0.10,
  Ceuta: 0.06,
  "Comunidad de Madrid": 0.06,
  "Comunidad Valenciana": 0.09,
  Extremadura: 0.08,
  Galicia: 0.09,
  "La Rioja": 0.07,
  Melilla: 0.06,
  Murcia: 0.08,
  Navarra: 0.06,
  "País Vasco": 0.04,
};

export const ITP_OPTIONS = Object.keys(ITP_RATES).sort();

export function getItpRate(community: string): number {
  return ITP_RATES[community] ?? 0.06;
}
