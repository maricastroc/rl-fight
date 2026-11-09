/**
 * Graduation catalogue. Edit this list to add, remove or reorder kruangs —
 * matching, grouping, colours and the certificate text all derive from it.
 */

export type KruangColor =
  | "branca"
  | "vermelha"
  | "azul-claro"
  | "azul-escura"
  | "roxa"
  | "marrom"
  | "preta";

/** Colours sampled from the kruang sequence printed on the certificate. */
export const KRUANG_HEX: Record<KruangColor, string> = {
  branca: "#FFFFFF",
  vermelha: "#BA3533",
  "azul-claro": "#408AC7",
  "azul-escura": "#232054",
  roxa: "#591B49",
  marrom: "#656154",
  preta: "#211E1F",
};

export type Graduation = {
  id: string;
  /** Standardised label printed on the certificate. */
  label: string;
  body: KruangColor;
  tip: KruangColor | null;
};

function graduation(body: KruangColor, tip: KruangColor | null, label: string): Graduation {
  return { id: tip ? `${body}-ponteira-${tip}` : body, label, body, tip };
}

export const GRADUATIONS: readonly Graduation[] = [
  graduation("branca", "vermelha", "Branca ponteira vermelha"),
  graduation("vermelha", null, "Vermelha"),
  graduation("vermelha", "azul-claro", "Vermelha ponteira azul-claro"),
  graduation("azul-claro", null, "Azul-claro"),
  graduation("azul-claro", "azul-escura", "Azul-claro ponteira azul-escura"),
  graduation("azul-escura", null, "Azul-escura"),
  graduation("azul-escura", "roxa", "Azul-escura ponteira roxa"),
  graduation("roxa", null, "Roxa"),
  graduation("roxa", "marrom", "Roxa ponteira marrom"),
  graduation("marrom", null, "Marrom"),
  graduation("marrom", "preta", "Marrom ponteira preta"),
  graduation("preta", null, "Preta"),
];

const BY_ID = new Map(GRADUATIONS.map((g) => [g.id, g]));
const ORDER = new Map(GRADUATIONS.map((g, index) => [g.id, index]));

export function getGraduation(id: string | null | undefined): Graduation | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function graduationOrder(id: string | null | undefined): number {
  const order = id ? ORDER.get(id) : undefined;
  return order ?? Number.MAX_SAFE_INTEGER;
}

export function findGraduationByColors(body: KruangColor, tip: KruangColor | null): Graduation | undefined {
  return GRADUATIONS.find((g) => g.body === body && g.tip === tip);
}
