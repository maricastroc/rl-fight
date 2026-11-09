import readExcelFile from "read-excel-file/universal";
import type { ExtractedSource } from "./types";

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR");
  if (value instanceof Date) return value.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  return "";
}

export async function extractXlsx(data: ArrayBuffer): Promise<ExtractedSource> {
  const sheets = await readExcelFile(data);
  return {
    format: "xlsx",
    sheets: sheets.map((sheet) => ({
      name: sheet.sheet,
      rows: sheet.data.map((row, rowIndex) => ({
        index: rowIndex + 1,
        cells: row.map(cellToText),
      })),
    })),
  };
}
