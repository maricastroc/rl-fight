import { matchGraduation, type GraduationMatch } from "../graduations/match";
import { cleanPersonName, collapseSpaces, foldKey, hasLetters, stripListMarker } from "../text/normalize";
import type { SourceRow } from "./types";

export type HeadingMatch = Exclude<GraduationMatch, { kind: "none" }>;

export type LineClass =
  | { type: "blank" }
  | { type: "decoration" }
  | { type: "summary-header" }
  | { type: "summary-entry"; quantity: number; label: string; match: GraduationMatch }
  | { type: "summary-total"; quantity: number }
  | { type: "heading"; label: string; match: HeadingMatch }
  | { type: "student"; name: string; numbered: boolean; graduation?: { label: string; match: HeadingMatch } }
  | { type: "title" }
  | { type: "unparsed" };

const UNIT = String.raw`(?:unidades?|unid\.?|und\.?|un\.?|pe[cç]as?|kruangs?)`;
const ENTRY_QUANTITY_FIRST = new RegExp(String.raw`^\(?\s*(\d{1,3})\s*${UNIT}\s*\)?\s*[-–—:.]?\s*(.+)$`, "iu");
const ENTRY_QUANTITY_LAST = new RegExp(String.raw`^(.+?)\s*[-–—:=]?\s*\(?\s*(\d{1,3})\s*${UNIT}\s*\)?\.?$`, "iu");
const BARE_QUANTITY_FIRST = /^(?:\(\s*(\d{1,3})\s*\)|(\d{1,3})\s*[-–—:.x]?)\s*(.+)$/iu;
const BARE_QUANTITY_LAST = /^(.+?)\s*[-–—:=]?\s*\(?\s*(\d{1,3})\s*\)?$/u;

const TITLE_WORDS = new Set([
  "lista", "listas", "graduacao", "graduacoes", "exame", "exames", "relacao", "aptos", "aptas",
  "turma", "turmas", "alunos", "alunas", "data", "academia", "dojo", "team", "equipe", "muay",
  "thai", "professor", "professora", "mestre", "local", "assinatura", "pagina", "semestre",
  "periodo", "evento", "certificado", "certificados", "pedido", "fight", "fit",
]);

const NAME_PATTERN = /^[\p{L}\p{M}'’ʼ`.\- ]+$/u;

export function looksLikeName(text: string): boolean {
  if (!NAME_PATTERN.test(text)) return false;
  const words = text.split(" ").filter(Boolean);
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  return words.length >= 1 && words.length <= 12 && letters >= 2;
}

function isTitleLike(text: string): boolean {
  if (/\b(19|20)\d{2}\b/.test(text)) return true;
  return foldKey(text)
    .split(" ")
    .some((word) => TITLE_WORDS.has(word));
}

function asHeading(match: GraduationMatch): HeadingMatch | null {
  return match.kind === "none" ? null : match;
}

function parseSummaryEntry(text: string, summaryMode: boolean): LineClass | null {
  const withUnit = text.match(ENTRY_QUANTITY_FIRST);
  if (withUnit) {
    const match = matchGraduation(withUnit[2]);
    if (match.kind !== "none") return { type: "summary-entry", quantity: Number(withUnit[1]), label: withUnit[2], match };
  }
  const unitLast = text.match(ENTRY_QUANTITY_LAST);
  if (unitLast) {
    const match = matchGraduation(unitLast[1]);
    if (match.kind !== "none") return { type: "summary-entry", quantity: Number(unitLast[2]), label: unitLast[1], match };
  }
  if (!summaryMode) return null;

  const bareFirst = text.match(BARE_QUANTITY_FIRST);
  if (bareFirst) {
    const label = bareFirst[3];
    const match = matchGraduation(label);
    if (match.kind !== "none") {
      return { type: "summary-entry", quantity: Number(bareFirst[1] ?? bareFirst[2]), label, match };
    }
  }
  const bareLast = text.match(BARE_QUANTITY_LAST);
  if (bareLast) {
    const match = matchGraduation(bareLast[1]);
    if (match.kind !== "none") return { type: "summary-entry", quantity: Number(bareLast[2]), label: bareLast[1], match };
  }
  return null;
}

function parseSummaryTotal(folded: string): number | null {
  if (!/^total\b/.test(folded) && !/^\d+ kruangs?$/.test(folded)) return null;
  const quantity = folded.match(/\d+/);
  return quantity ? Number(quantity[0]) : null;
}

function isSummaryHeader(folded: string): boolean {
  if (!/\bkruangs?\b/.test(folded)) return false;
  return /\bkruangs\b/.test(folded) || /\b(pedido|resumo|quantidade|encomenda|lista)\b/.test(folded);
}

/** Splits "MARIA SILVA - VERMELHA" style lines into a name and a graduation. */
function splitInlineGraduation(text: string): LineClass | null {
  const parts = text.split(/\s+[-–—|:]\s+|\s*;\s*|\s*\t\s*/u).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  for (const [namePart, graduationPart] of [parts, [parts[1], parts[0]]] as const) {
    const match = asHeading(matchGraduation(graduationPart));
    const { text: nameText, numbered } = stripListMarker(namePart);
    const name = cleanPersonName(nameText);
    if (match && looksLikeName(name) && matchGraduation(name).kind === "none") {
      return { type: "student", name, numbered, graduation: { label: graduationPart, match } };
    }
  }
  return null;
}

export function rowToLine(row: SourceRow): string {
  const cells = row.cells.map(collapseSpaces).filter(Boolean);
  const hasText = cells.some(hasLetters);
  const meaningful = hasText ? cells.filter((cell) => !/^\d{1,4}[.)º°]?$/.test(cell)) : cells;
  return meaningful.join("\t");
}

export function classifyLine(line: string, context: { listItem: boolean; summaryMode: boolean }): LineClass {
  const text = collapseSpaces(line.replace(/\t/g, " \t "));
  if (!text) return { type: "blank" };
  if (!/[\p{L}\p{N}]/u.test(text)) return { type: "decoration" };

  const flat = collapseSpaces(text.replace(/\t/g, " "));
  const folded = foldKey(flat);

  const total = parseSummaryTotal(folded);
  if (total !== null) return { type: "summary-total", quantity: total };

  const entry = parseSummaryEntry(flat, context.summaryMode);
  if (entry) return entry;

  const { text: unmarked, numbered } = stripListMarker(flat);
  const heading = asHeading(matchGraduation(unmarked));
  if (heading) return { type: "heading", label: collapseSpaces(unmarked), match: heading };

  if (isSummaryHeader(folded)) return { type: "summary-header" };

  const inline = splitInlineGraduation(line.includes("\t") ? line : flat);
  if (inline) return inline;

  const name = cleanPersonName(unmarked);
  const isListed = context.listItem || numbered;
  if (looksLikeName(name) && (isListed || !isTitleLike(name))) {
    return { type: "student", name, numbered: isListed };
  }
  if (!isListed && isTitleLike(flat)) return { type: "title" };
  return { type: "unparsed" };
}
