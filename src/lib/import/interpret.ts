import { getGraduation } from "../graduations/catalog";
import { matchGraduation } from "../graduations/match";
import { cleanPersonName, collapseSpaces, foldKey } from "../text/normalize";
import { classifyLine, looksLikeName, rowToLine, type LineClass } from "./classify";
import type {
  GraduationGroup,
  ImportNote,
  InterpretOptions,
  KruangSummary,
  ParsedStudent,
  SheetInterpretation,
  SourceRow,
  SourceSheet,
  TabularLayout,
} from "./types";

const NAME_HEADER = /\b(nome|nomes|aluno|alunos|aluna|alunas|atleta|atletas|praticante|praticantes|estudante|estudantes)\b/;
const GRADUATION_HEADER = /\b(graduacao|graduacoes|faixa|faixas|kruang|kruangs|prajied|cordao|grau|nivel)\b/;
const TARGET_HEADER = /\b(pretendida|pretendido|nova|novo|proxima|proximo|futura|destino|alvo|graduar|exame)\b/;
const CURRENT_HEADER = /\b(atual|anterior|antiga|antigo|vigente|recebida|possui|origem)\b/;
const HEADER_SCAN_ROWS = 25;

function graduationLabel(id: string | null): string {
  return getGraduation(id)?.label ?? "sem graduação";
}

function cellAt(row: SourceRow, column: number): string {
  return collapseSpaces(row.cells[column] ?? "");
}

function headerLayout(row: SourceRow): TabularLayout | null {
  const headers = row.cells.map(foldKey);
  const nameColumns = headers.flatMap((h, i) => (NAME_HEADER.test(h) && !GRADUATION_HEADER.test(h) ? [i] : []));
  const graduationColumns = headers
    .flatMap((h, i) => (GRADUATION_HEADER.test(h) ? [i] : []))
    .map((index) => {
      const header = headers[index];
      const score = (TARGET_HEADER.test(header) ? 3 : 0) - (CURRENT_HEADER.test(header) ? 3 : 0);
      return { index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (nameColumns.length === 0 || graduationColumns.length === 0) return null;

  const nameColumn = nameColumns[0];
  const graduationColumn = graduationColumns[0].index;
  return {
    headerRow: row.index,
    nameColumn,
    graduationColumn,
    columns: row.cells.map((cell, index) => ({
      index,
      header: collapseSpaces(cell),
      role: index === nameColumn ? "name" : index === graduationColumn ? "graduation" : "other",
    })),
  };
}

/** Finds a "Nome | Graduação" layout, with or without a header row. */
export function detectTabularLayout(rows: SourceRow[]): TabularLayout | null {
  for (const row of rows.slice(0, HEADER_SCAN_ROWS)) {
    const layout = headerLayout(row);
    if (layout) return layout;
  }

  const width = Math.max(0, ...rows.map((r) => r.cells.length));
  if (width < 2) return null;
  const stats = Array.from({ length: width }, (_, column) => {
    const values = rows.map((r) => cellAt(r, column)).filter(Boolean);
    const graduations = values.filter((v) => matchGraduation(v).kind === "match").length;
    const names = values.filter((v) => {
      const name = cleanPersonName(v);
      return looksLikeName(name) && matchGraduation(name).kind === "none";
    }).length;
    return { column, filled: values.length, graduations, names };
  });

  const graduationStat = stats
    .filter((s) => s.filled >= 3 && s.graduations / s.filled >= 0.6)
    .sort((a, b) => b.graduations - a.graduations)[0];
  if (!graduationStat) return null;
  const nameStat = stats
    .filter((s) => s.column !== graduationStat.column && s.filled >= 3 && s.names / s.filled >= 0.6)
    .sort((a, b) => b.names - a.names)[0];
  if (!nameStat) return null;

  const paired = rows.filter(
    (r) => cellAt(r, nameStat.column) && matchGraduation(cellAt(r, graduationStat.column)).kind === "match",
  ).length;
  if (paired / nameStat.filled < 0.6) return null;

  return {
    headerRow: null,
    nameColumn: nameStat.column,
    graduationColumn: graduationStat.column,
    columns: Array.from({ length: width }, (_, index) => ({
      index,
      header: `Coluna ${String.fromCharCode(65 + (index % 26))}`,
      role: index === nameStat.column ? "name" : index === graduationStat.column ? "graduation" : "other",
    })),
  };
}

class SummaryCollector {
  summary: KruangSummary | null = null;

  accept(line: LineClass, row: number): boolean {
    if (line.type === "summary-header") {
      this.summary ??= { entries: [], total: null };
      return true;
    }
    if (line.type === "summary-entry") {
      this.summary ??= { entries: [], total: null };
      this.summary.entries.push({
        graduationId: line.match.kind === "match" ? line.match.graduation.id : null,
        text: collapseSpaces(line.label),
        quantity: line.quantity,
        row,
      });
      return true;
    }
    if (line.type === "summary-total") {
      this.summary ??= { entries: [], total: null };
      this.summary.total = { quantity: line.quantity, row };
      return true;
    }
    return false;
  }
}

function groupsFromStudents(students: ParsedStudent[]): GraduationGroup[] {
  const groups = new Map<string, GraduationGroup>();
  for (const student of students) {
    const key = student.graduationId ?? `?${student.graduationText ?? ""}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else {
      groups.set(key, {
        graduationId: student.graduationId,
        text: student.graduationText ?? "",
        row: student.sourceRow,
        inferred: student.inferred,
        count: 1,
      });
    }
  }
  return [...groups.values()];
}

function interpretTabular(rows: SourceRow[], layout: TabularLayout): SheetInterpretation {
  const students: ParsedStudent[] = [];
  const notes: ImportNote[] = [];
  const summary = new SummaryCollector();

  for (const row of rows) {
    if (layout.headerRow !== null && row.index <= layout.headerRow) {
      if (row.index < layout.headerRow && rowToLine(row)) {
        notes.push({ kind: "ignored", severity: "info", row: row.index, text: rowToLine(row), message: "Título acima da tabela" });
      }
      continue;
    }
    const nameText = cellAt(row, layout.nameColumn);
    const graduationText = cellAt(row, layout.graduationColumn);
    const line = rowToLine(row);
    if (!line) continue;

    const classified = classifyLine(line, { listItem: false, summaryMode: summary.summary !== null });
    if (summary.accept(classified, row.index)) continue;

    if (!nameText && !graduationText) {
      notes.push({ kind: "ignored", severity: "info", row: row.index, text: line, message: "Linha fora das colunas de nome e graduação" });
      continue;
    }
    if (headerLayout(row)) {
      notes.push({ kind: "ignored", severity: "info", row: row.index, text: line, message: "Cabeçalho repetido" });
      continue;
    }

    const match = graduationText ? matchGraduation(graduationText) : null;
    const graduationId = match?.kind === "match" ? match.graduation.id : null;
    const inferred = match?.kind === "match" && match.inferred;
    if (graduationText && !graduationId) {
      notes.push({
        kind: "unknown-graduation",
        severity: "warning",
        row: row.index,
        text: graduationText,
        message: `“${graduationText}” não corresponde a nenhuma graduação conhecida.`,
      });
    }
    students.push({
      name: cleanPersonName(nameText),
      graduationId,
      graduationText: graduationText || null,
      inferred,
      sourceRow: row.index,
    });
  }

  return {
    structure: "tabular",
    students,
    groups: groupsFromStudents(students),
    summary: summary.summary,
    notes,
    tabular: layout,
  };
}

function interpretGrouped(rows: SourceRow[]): SheetInterpretation {
  const students: ParsedStudent[] = [];
  const notes: ImportNote[] = [];
  const groups: GraduationGroup[] = [];
  const summary = new SummaryCollector();
  let summaryMode = false;
  let current: GraduationGroup | null = null;

  for (const row of rows) {
    const line = rowToLine(row);
    const text = collapseSpaces(line);
    const classified = classifyLine(line, { listItem: Boolean(row.listItem), summaryMode });

    if (summary.accept(classified, row.index)) {
      summaryMode = true;
      continue;
    }

    switch (classified.type) {
      case "blank":
      case "decoration":
        break;

      case "heading": {
        summaryMode = false;
        const { match } = classified;
        const graduationId = match.kind === "match" ? match.graduation.id : null;
        const inferred = match.kind === "match" && match.inferred;
        current = { graduationId, text: classified.label, row: row.index, inferred, count: 0 };
        groups.push(current);
        if (match.kind === "unknown") {
          notes.push({
            kind: "unknown-graduation",
            severity: "warning",
            row: row.index,
            text: classified.label,
            message: `“${classified.label}” parece uma graduação, mas não está na lista de graduações conhecidas.`,
          });
        } else if (inferred) {
          notes.push({
            kind: "inferred-graduation",
            severity: "warning",
            row: row.index,
            text: classified.label,
            graduationId: match.graduation.id,
            message: `“${classified.label}” foi interpretado como ${match.graduation.label}.`,
          });
        }
        break;
      }

      case "student": {
        if (summaryMode) {
          notes.push({ kind: "ignored", severity: "info", row: row.index, text, message: "Linha dentro do resumo de kruangs" });
          break;
        }
        if (classified.graduation) {
          const { match, label } = classified.graduation;
          students.push({
            name: classified.name,
            graduationId: match.kind === "match" ? match.graduation.id : null,
            graduationText: label,
            inferred: match.kind === "match" && match.inferred,
            sourceRow: row.index,
          });
          break;
        }
        if (!current) {
          notes.push({
            kind: "unparsed",
            severity: "warning",
            row: row.index,
            text: classified.name,
            graduationId: null,
            message: "Nome encontrado antes de qualquer graduação",
          });
          break;
        }
        current.count += 1;
        students.push({
          name: classified.name,
          graduationId: current.graduationId,
          graduationText: current.text,
          inferred: current.inferred,
          sourceRow: row.index,
        });
        break;
      }

      case "title":
        notes.push({ kind: "ignored", severity: "info", row: row.index, text, message: "Título ou texto informativo" });
        break;

      case "unparsed":
        notes.push(
          summaryMode
            ? { kind: "ignored", severity: "info", row: row.index, text, message: "Linha dentro do resumo de kruangs" }
            : {
                kind: "unparsed",
                severity: "warning",
                row: row.index,
                text,
                graduationId: current?.graduationId ?? null,
                message: "Linha não reconhecida como nome ou graduação",
              },
        );
        break;
    }
  }

  for (const group of groups) {
    if (group.count === 0) {
      notes.push({
        kind: "empty-graduation",
        severity: "info",
        row: group.row,
        text: group.text,
        graduationId: group.graduationId,
        message: `Nenhum aluno em ${group.graduationId ? graduationLabel(group.graduationId) : `“${group.text}”`}`,
      });
    }
  }

  return { structure: "grouped", students, groups, summary: summary.summary, notes, tabular: null };
}

export function interpretSheet(sheet: SourceSheet, options: InterpretOptions = {}): SheetInterpretation {
  const rows = sheet.rows.filter((row) => row.cells.some((cell) => collapseSpaces(cell)));
  if (rows.length === 0) {
    return { structure: "empty", students: [], groups: [], summary: null, notes: [], tabular: null };
  }

  if (options.columns) {
    const detected = detectTabularLayout(rows);
    const width = Math.max(...rows.map((r) => r.cells.length));
    const { nameColumn, graduationColumn } = options.columns;
    const layout: TabularLayout = {
      headerRow: detected?.headerRow ?? null,
      nameColumn,
      graduationColumn,
      columns: Array.from({ length: width }, (_, index) => ({
        index,
        header: detected?.columns[index]?.header || `Coluna ${String.fromCharCode(65 + (index % 26))}`,
        role: index === nameColumn ? "name" : index === graduationColumn ? "graduation" : "other",
      })),
    };
    return interpretTabular(rows, layout);
  }

  const layout = detectTabularLayout(rows);
  return layout ? interpretTabular(rows, layout) : interpretGrouped(rows);
}
