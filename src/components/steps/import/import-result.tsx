"use client";

import { ArrowRight, FileSpreadsheet, FileText, Info, RefreshCcw, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { DistributionBar, GraduationList, countsInOrder } from "@/components/students/graduation-breakdown";
import { SummaryCheckView } from "@/components/students/summary-check";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/select";
import { formatBytes } from "@/lib/browser/download";
import type { InterpretedSource } from "@/lib/import/import-file";
import type { SourceFormat } from "@/lib/import/types";
import { countByGraduation, studentsFromImport } from "@/lib/students/model";
import { reconcileSummary, validateStudents } from "@/lib/validation/validate";

type ImportResultProps = {
  file: { name: string; size: number };
  format: SourceFormat;
  result: InterpretedSource;
  onSheetChange: (index: number) => void;
  onColumnsChange: (columns: { nameColumn: number; graduationColumn: number }) => void;
  onReplace: () => void;
  onContinue: () => void;
};

function Stat({ value, label, tone = "default" }: { value: number; label: string; tone?: "default" | "warning" }) {
  return (
    <div className="flex flex-col gap-1.5 px-6 py-6 first:pl-0 sm:px-8">
      <span
        className={cn(
          "font-display text-[clamp(2.2rem,4vw,3.25rem)] font-[760] leading-none tracking-[-0.04em] tabular-nums font-stretch-105%",
          tone === "warning" && value > 0 ? "text-amber-300" : "text-bone-50",
        )}
      >
        {value}
      </span>
      <span className="text-[13px] text-bone-500">{label}</span>
    </div>
  );
}

export function ImportResult({ file, format, result, onSheetChange, onColumnsChange, onReplace, onContinue }: ImportResultProps) {
  const { interpretation, sheets, sheetIndex } = result;

  const analysis = useMemo(() => {
    const students = studentsFromImport(interpretation.students);
    const issues = validateStudents(students);
    const emptyGroups = interpretation.groups.filter((g) => g.count === 0 && g.graduationId).map((g) => g.graduationId as string);
    const counts = countsInOrder(countByGraduation(students), emptyGroups);
    const summary = interpretation.summary ? reconcileSummary(interpretation.summary, students) : null;
    return { students, issues, counts, summary };
  }, [interpretation]);

  const graduations = analysis.counts.filter((c) => c.graduationId && c.count > 0).length;
  const warnings = interpretation.notes.filter((n) => n.severity === "warning");
  const ignored = interpretation.notes.filter((n) => n.kind === "ignored");
  const FormatIcon = format === "docx" ? FileText : FileSpreadsheet;
  const tabular = interpretation.tabular;
  const columnOptions = tabular?.columns.map((c) => ({ value: String(c.index), label: c.header || `Coluna ${c.index + 1}` })) ?? [];

  return (
    <motion.section
      aria-label="Resultado da importação"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-line-strong bg-ink-900/70"
    >
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line px-6 py-5 sm:px-8">
        <span className="grid size-11 place-items-center rounded-xl border border-line-strong bg-ink-850 text-bone-200">
          <FormatIcon aria-hidden className="size-5" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-bone-50" title={file.name}>
            {file.name}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-bone-500">
            {format} · {formatBytes(file.size)}
            {interpretation.structure === "tabular" ? " · tabela" : interpretation.structure === "grouped" ? " · lista por graduação" : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCcw className="size-3.5" />} onClick={onReplace}>
          Trocar arquivo
        </Button>
      </header>

      {sheets.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4 sm:px-8">
          <span className="text-[13px] text-bone-500">Aba da planilha</span>
          <div role="tablist" aria-label="Abas da planilha" className="flex flex-wrap gap-1.5">
            {sheets.map((sheet, index) => (
              <button
                key={sheet.name + index}
                type="button"
                role="tab"
                aria-selected={index === sheetIndex}
                onClick={() => onSheetChange(index)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                  index === sheetIndex
                    ? "border-bone-300 bg-bone-50 text-ink-950"
                    : "border-line-strong text-bone-300 hover:border-bone-500 hover:text-bone-50",
                )}
              >
                {sheet.name}
                <span className={cn("ml-2 font-mono text-[11px]", index === sheetIndex ? "text-ink-700" : "text-bone-500")}>
                  {sheet.studentCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tabular && (
        <div className="grid gap-4 border-b border-line px-6 py-5 sm:grid-cols-2 sm:px-8">
          <label className="flex flex-col gap-2 text-[13px] text-bone-500">
            Coluna com o nome
            <Select
              aria-label="Coluna com o nome"
              value={String(tabular.nameColumn)}
              options={columnOptions}
              onValueChange={(value) => onColumnsChange({ nameColumn: Number(value), graduationColumn: tabular.graduationColumn })}
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] text-bone-500">
            Coluna com a graduação a receber
            <Select
              aria-label="Coluna com a graduação"
              value={String(tabular.graduationColumn)}
              options={columnOptions}
              onValueChange={(value) => onColumnsChange({ nameColumn: tabular.nameColumn, graduationColumn: Number(value) })}
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line px-6 sm:px-8">
        <Stat value={analysis.students.length} label={analysis.students.length === 1 ? "aluno" : "alunos"} />
        <Stat value={graduations} label={graduations === 1 ? "graduação" : "graduações"} />
        <Stat value={analysis.issues.size} label="para revisar" tone="warning" />
      </div>

      {analysis.students.length === 0 ? (
        <div className="px-6 py-10 sm:px-8">
          <p className="font-display text-xl font-bold text-bone-50">Nenhum aluno encontrado neste arquivo.</p>
          <p className="mt-3 max-w-[60ch] text-[14.5px] leading-relaxed text-bone-400">
            A lista precisa ter os nomes agrupados sob o título de cada graduação, ou uma tabela com uma coluna de nome e outra de
            graduação. Veja os exemplos ao lado e tente outro arquivo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-7 px-6 py-7 sm:px-8">
          <DistributionBar counts={analysis.counts} />
          <GraduationList counts={analysis.counts} />
          {analysis.summary && <SummaryCheckView check={analysis.summary} />}
          {warnings.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {warnings.map((note) => (
                <li key={`${note.kind}-${note.row}`} className="flex items-start gap-3 text-[14px] leading-relaxed text-amber-300">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <span>
                    {note.message}
                    {note.kind === "unparsed" && <span className="text-bone-400"> — “{note.text}”</span>}
                    <span className="ml-2 font-mono text-[11px] text-bone-600">linha {note.row}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {ignored.length > 0 && (
            <details className="group text-[14px] text-bone-400">
              <summary className="flex cursor-pointer list-none items-center gap-3 hover:text-bone-200">
                <Info aria-hidden className="size-4 text-bone-500" />
                {ignored.length === 1 ? "1 linha ignorada" : `${ignored.length} linhas ignoradas`} (títulos e textos informativos)
                <span className="text-bone-600 group-open:hidden">· ver</span>
              </summary>
              <ul className="mt-3 flex flex-col gap-1.5 pl-7">
                {ignored.map((note) => (
                  <li key={`${note.row}`} className="text-[13px] text-bone-500">
                    <span className="font-mono text-[11px] text-bone-600">linha {note.row}</span> · “{note.text}”
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-ink-950/40 px-6 py-5 sm:px-8">
        <p className="text-[13.5px] text-bone-500">
          {analysis.issues.size > 0
            ? "Os itens marcados poderão ser corrigidos na próxima etapa."
            : analysis.students.length > 0
              ? "Tudo certo para conferir."
              : ""}
        </p>
        <Button
          variant="primary"
          size="lg"
          disabled={analysis.students.length === 0}
          onClick={onContinue}
          trailingIcon={<ArrowRight className="size-4" />}
        >
          Conferir alunos
        </Button>
      </footer>
    </motion.section>
  );
}
