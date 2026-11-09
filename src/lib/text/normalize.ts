const SPACE_LIKE = /[\s   -​  　﻿]+/g;

export function collapseSpaces(value: string): string {
  return value.normalize("NFC").replace(SPACE_LIKE, " ").trim();
}

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

/** Accent-, case- and punctuation-insensitive key used for comparisons. */
export function foldKey(value: string): string {
  return stripAccents(collapseSpaces(value))
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function hasLetters(value: string): boolean {
  return /\p{L}/u.test(value);
}

const NUMBERING_PREFIX =
  /^\s*(?:n[º°o.]\s*)?\d{1,4}\s*(?:[.)\-–—:ºª°]+\s*|\s+(?=\p{L}))/u;
const BULLET_PREFIX = /^\s*[•●◦▪▫■□►▸‣⁃*·\-–—]+\s*/u;

/** Removes manual list markers such as "1.", "01 -", "3)" or bullets. */
export function stripListMarker(value: string): { text: string; numbered: boolean } {
  const numbered = NUMBERING_PREFIX.test(value);
  const withoutNumber = value.replace(NUMBERING_PREFIX, "");
  const text = withoutNumber.replace(BULLET_PREFIX, "");
  return { text, numbered: numbered || text !== withoutNumber };
}

export function cleanPersonName(raw: string): string {
  let name = collapseSpaces(stripListMarker(collapseSpaces(raw)).text);
  name = name.replace(/[\s,;:•\-–—]+$/u, "");
  const lastWord = name.split(" ").at(-1) ?? "";
  if (lastWord.endsWith(".") && lastWord.replace(/\.$/, "").length > 3) {
    name = name.slice(0, -1);
  }
  return name.trim();
}
