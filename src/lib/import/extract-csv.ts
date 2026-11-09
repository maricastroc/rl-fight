import Papa from "papaparse";
import type { ExtractedSource } from "./types";

/** Decodes text files saved by common Brazilian tools (UTF-8, Excel's Windows-1252, UTF-16). */
export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "UTF-16" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "UTF-16" };
  }
  const bomLength = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(bomLength)), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "Windows-1252" };
  }
}

const DELIMITERS = [";", ",", "\t", "|"];

/** Guesses the separator on non-blank lines only: blank lines (common at the end of Excel exports) confuse detection. */
function detectDelimiter(text: string): string {
  const sample = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "")
    .slice(0, 200)
    .join("\n");
  const guess = Papa.parse<string[]>(sample, { delimitersToGuess: DELIMITERS, preview: 200 });
  const undetectable = guess.errors.some((error) => error.code === "UndetectableDelimiter");
  return undetectable ? "," : guess.meta.delimiter;
}

export function extractCsv(data: ArrayBuffer): ExtractedSource {
  const { text, encoding } = decodeText(new Uint8Array(data));
  const delimiter = detectDelimiter(text);
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
  return {
    format: "csv",
    encoding,
    delimiter,
    sheets: [
      {
        name: "Planilha",
        rows: parsed.data.map((cells, rowIndex) => ({ index: rowIndex + 1, cells })),
      },
    ],
  };
}
