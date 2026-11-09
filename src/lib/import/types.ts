export type SourceFormat = "docx" | "xlsx" | "csv";

/** One logical line of the source: a paragraph, a table row, a spreadsheet row or a CSV record. */
export type SourceRow = {
  /** 1-based position in the source (paragraph, row or record number). */
  index: number;
  cells: string[];
  /** True for paragraphs that belong to a Word numbered or bulleted list. */
  listItem?: boolean;
};

export type SourceSheet = {
  name: string;
  rows: SourceRow[];
};

export type ExtractedSource = {
  format: SourceFormat;
  sheets: SourceSheet[];
  encoding?: string;
  delimiter?: string;
};

export type ParsedStudent = {
  name: string;
  graduationId: string | null;
  /** Graduation text exactly as written in the file. */
  graduationText: string | null;
  /** The graduation needed a guess (typo correction, extra words) and should be confirmed. */
  inferred: boolean;
  sourceRow: number;
};

export type ImportNote =
  | { kind: "ignored"; severity: "info"; row: number; text: string; message: string }
  | {
      kind: "unparsed";
      severity: "warning";
      row: number;
      text: string;
      message: string;
      /** Graduation in effect where the line appeared, so it can be added as a student. */
      graduationId: string | null;
    }
  | { kind: "empty-graduation"; severity: "info"; row: number; text: string; graduationId: string | null; message: string }
  | { kind: "unknown-graduation"; severity: "warning"; row: number; text: string; message: string }
  | { kind: "inferred-graduation"; severity: "warning"; row: number; text: string; graduationId: string; message: string };

export type GraduationGroup = {
  graduationId: string | null;
  text: string;
  row: number;
  inferred: boolean;
  count: number;
};

export type KruangSummaryEntry = {
  graduationId: string | null;
  text: string;
  quantity: number;
  row: number;
};

export type KruangSummary = {
  entries: KruangSummaryEntry[];
  total: { quantity: number; row: number } | null;
};

export type ColumnRole = "name" | "graduation" | "other";

export type TabularLayout = {
  headerRow: number | null;
  nameColumn: number;
  graduationColumn: number;
  columns: { index: number; header: string; role: ColumnRole }[];
};

export type SheetStructure = "grouped" | "tabular" | "columns" | "empty";

export type SheetInterpretation = {
  structure: SheetStructure;
  students: ParsedStudent[];
  groups: GraduationGroup[];
  summary: KruangSummary | null;
  notes: ImportNote[];
  tabular: TabularLayout | null;
};

export type InterpretOptions = {
  columns?: { nameColumn: number; graduationColumn: number };
};

export class ImportError extends Error {
  constructor(
    readonly code: "unsupported" | "legacy-format" | "corrupted" | "empty" | "too-large",
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
