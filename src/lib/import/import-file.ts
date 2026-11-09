import { interpretSheet } from "./interpret";
import {
  ImportError,
  type ExtractedSource,
  type InterpretOptions,
  type SheetInterpretation,
  type SourceFormat,
} from "./types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type FileLike = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

export type SheetOverview = { name: string; studentCount: number };

export type InterpretedSource = {
  sheetIndex: number;
  interpretation: SheetInterpretation;
  sheets: SheetOverview[];
};

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function detectFormat(fileName: string, bytes: Uint8Array): SourceFormat {
  const extension = extensionOf(fileName);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isLegacyOffice = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

  if (["doc", "xls"].includes(extension) || (isLegacyOffice && ["docx", "xlsx"].includes(extension))) {
    throw new ImportError(
      "legacy-format",
      "Este arquivo está em um formato antigo do Office ou protegido por senha. Abra-o no Word ou Excel e use “Salvar como” .docx ou .xlsx.",
    );
  }
  if (extension === "docx") {
    if (!isZip) throw new ImportError("corrupted", "Este arquivo .docx parece estar corrompido.");
    return "docx";
  }
  if (extension === "xlsx" || extension === "xlsm") {
    if (!isZip) throw new ImportError("corrupted", "Este arquivo .xlsx parece estar corrompido.");
    return "xlsx";
  }
  if (["csv", "txt", "tsv"].includes(extension)) return "csv";
  throw new ImportError("unsupported", "Formato não suportado. Envie um arquivo .docx, .xlsx ou .csv.");
}

export async function readSource(file: FileLike): Promise<ExtractedSource> {
  if (file.size === 0) throw new ImportError("empty", "O arquivo está vazio.");
  if (file.size > MAX_FILE_SIZE) throw new ImportError("too-large", "O arquivo tem mais de 20 MB. Envie apenas a lista de alunos.");

  const data = await file.arrayBuffer();
  const format = detectFormat(file.name, new Uint8Array(data));
  try {
    // Readers are loaded on demand so the first screen does not wait for them.
    if (format === "docx") return await (await import("./extract-docx")).extractDocx(data);
    if (format === "xlsx") return await (await import("./extract-xlsx")).extractXlsx(data);
    return (await import("./extract-csv")).extractCsv(data);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError(
      "corrupted",
      "Não foi possível ler este arquivo. Ele pode estar corrompido ou protegido por senha.",
    );
  }
}

/** Interprets every sheet and selects the requested one, or the one with the most students. */
export function interpretSource(
  source: ExtractedSource,
  sheetIndex?: number,
  options?: InterpretOptions,
): InterpretedSource {
  const results = source.sheets.map((sheet, index) =>
    interpretSheet(sheet, index === sheetIndex ? options : undefined),
  );
  const sheets = source.sheets.map((sheet, index) => ({
    name: sheet.name,
    studentCount: results[index].students.length,
  }));
  const chosen =
    sheetIndex ??
    sheets.reduce((best, sheet, index) => (sheet.studentCount > sheets[best].studentCount ? index : best), 0);
  return { sheetIndex: chosen, interpretation: results[chosen], sheets };
}
