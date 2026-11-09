import { editDistance } from "../text/distance";
import { collapseSpaces, stripAccents } from "../text/normalize";
import { findGraduationByColors, type Graduation, type KruangColor } from "./catalog";

type BaseColor = "branca" | "vermelha" | "azul" | "roxa" | "marrom" | "preta";

type Token =
  | { kind: "color"; value: BaseColor }
  | { kind: "shade"; value: "claro" | "escuro" }
  | { kind: "tip" }
  | { kind: "drop" };

const color = (value: BaseColor): Token => ({ kind: "color", value });
const shade = (value: "claro" | "escuro"): Token => ({ kind: "shade", value });
const TIP: Token = { kind: "tip" };
const DROP: Token = { kind: "drop" };

/** Spelling variants accepted as exact matches. */
const VOCABULARY: Record<string, Token> = {
  branca: color("branca"),
  branco: color("branca"),
  vermelha: color("vermelha"),
  vermelho: color("vermelha"),
  azul: color("azul"),
  roxa: color("roxa"),
  roxo: color("roxa"),
  marrom: color("marrom"),
  marron: color("marrom"),
  preta: color("preta"),
  preto: color("preta"),
  claro: shade("claro"),
  clara: shade("claro"),
  escuro: shade("escuro"),
  escura: shade("escuro"),
  ponteira: TIP,
  ponteiras: TIP,
  ponteiro: TIP,
  ponta: TIP,
  pontas: TIP,
  de: DROP,
  da: DROP,
  do: DROP,
  com: DROP,
  c: DROP,
  e: DROP,
  kruang: DROP,
  kruangs: DROP,
  faixa: DROP,
  faixas: DROP,
  grau: DROP,
  graus: DROP,
  graduacao: DROP,
  graduacoes: DROP,
  prajied: DROP,
  prajiad: DROP,
  cordao: DROP,
  nivel: DROP,
};

const COUNT_WORDS = new Set(["aluno", "alunos", "aluna", "alunas", "pessoas"]);

/** Words long enough to be corrected when misspelled (e.g. "GRAL" → "grau", "VERMLHA" → "vermelha"). */
const FUZZY_TARGETS = Object.keys(VOCABULARY).filter((word) => {
  if (word.length < 4 || /\d/.test(word)) return false;
  const token = VOCABULARY[word];
  return token.kind === "drop" || word.length >= 5;
});

export type GraduationMatch =
  | { kind: "match"; graduation: Graduation; inferred: boolean }
  | { kind: "unknown" }
  | { kind: "none" };

function tokenKey(token: Token): string {
  return "value" in token ? `${token.kind}:${token.value}` : token.kind;
}

function resolveToken(word: string): { token: Token; fuzzy: boolean } | null {
  const exact = VOCABULARY[word];
  if (exact) return { token: exact, fuzzy: false };
  if (word.length < 4) return null;

  const limit = word.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestDistance = limit + 1;
  let tie = false;
  for (const target of FUZZY_TARGETS) {
    const distance = editDistance(word, target, limit);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
      tie = false;
    } else if (distance === bestDistance) {
      tie = tie || (best !== null && tokenKey(VOCABULARY[target]) !== tokenKey(VOCABULARY[best]));
    }
  }
  if (!best || bestDistance > limit || tie) return null;
  return { token: VOCABULARY[best], fuzzy: true };
}

function readColor(tokens: Token[], start: number): { color: KruangColor; next: number } | "invalid" {
  const head = tokens[start];
  if (!head || head.kind !== "color") return "invalid";
  const following = tokens[start + 1];
  if (head.value === "azul") {
    if (following?.kind !== "shade") return "invalid";
    return {
      color: following.value === "claro" ? "azul-claro" : "azul-escura",
      next: start + 2,
    };
  }
  if (following?.kind === "shade") return "invalid";
  return { color: head.value, next: start + 1 };
}

function parseColors(tokens: Token[]): { body: KruangColor; tip: KruangColor | null } | null {
  const body = readColor(tokens, 0);
  if (body === "invalid") return null;
  if (body.next === tokens.length) return { body: body.color, tip: null };
  if (tokens[body.next]?.kind !== "tip") return null;
  const tip = readColor(tokens, body.next + 1);
  if (tip === "invalid" || tip.next !== tokens.length) return null;
  return { body: body.color, tip: tip.color };
}

/**
 * Interprets free text as a graduation.
 * - "match": resolved to the catalogue (inferred = needed a guess the user should confirm);
 * - "unknown": clearly describes a kruang, but not one in the catalogue (or ambiguous, e.g. "AZUL");
 * - "none": not a graduation.
 */
export function matchGraduation(raw: string): GraduationMatch {
  let inferred = false;
  let text = collapseSpaces(raw);

  for (const [, content] of text.matchAll(/\(([^)]*)\)/g)) {
    const words = stripAccents(content).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const isCount = words.length > 0 && words.every((w) => /^\d+$/.test(w) || COUNT_WORDS.has(w));
    if (!isCount && words.some((w) => /^\d+$/.test(w))) return { kind: "none" };
    if (!isCount && words.length > 0) inferred = true;
  }
  text = text.replace(/\([^)]*\)/g, " ");

  const words = stripAccents(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !/^\d+$/.test(word) && !COUNT_WORDS.has(word));
  if (words.length === 0 || words.length > 9) return { kind: "none" };

  const tokens: Token[] = [];
  let recognisedColor = false;
  for (const word of words) {
    const resolved = resolveToken(word);
    if (!resolved) return { kind: "none" };
    if (resolved.fuzzy) inferred = true;
    // A colour must be spelled right, or be long enough that a one-letter slip is unambiguous ("VERMLHA").
    if (resolved.token.kind === "color" && (!resolved.fuzzy || word.length >= 6)) recognisedColor = true;
    if (resolved.token.kind !== "drop") tokens.push(resolved.token);
  }
  if (!recognisedColor) return { kind: "none" };

  const colors = parseColors(tokens);
  if (!colors) return { kind: "unknown" };
  const graduation = findGraduationByColors(colors.body, colors.tip);
  if (!graduation) return { kind: "unknown" };
  return { kind: "match", graduation, inferred };
}
