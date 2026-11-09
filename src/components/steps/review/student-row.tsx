"use client";

import { CircleAlert, Trash2, TriangleAlert } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { graduationOptions } from "@/components/students/graduation-options";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/select";
import type { Student } from "@/lib/students/model";
import { cleanPersonName } from "@/lib/text/normalize";
import type { StudentIssue } from "@/lib/validation/validate";

const OPTIONS = graduationOptions();

type StudentRowProps = {
  student: Student;
  position: number;
  issues: StudentIssue[] | undefined;
  highlighted: boolean;
  onRename: (id: string, name: string) => void;
  onGraduation: (id: string, graduation: string) => void;
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
};

function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => (armed ? onRemove() : setArmed(true))}
      onBlur={() => setArmed(false)}
      onKeyDown={(event) => event.key === "Escape" && setArmed(false)}
      aria-label={armed ? `Confirmar remoção de ${name || "aluno sem nome"}` : `Remover ${name || "aluno sem nome"}`}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-lg text-[12.5px] font-medium transition-all duration-200",
        armed
          ? "w-[92px] bg-signal-500 px-2.5 text-white"
          : "w-9 text-bone-600 hover:bg-ink-800 hover:text-signal-300 group-hover/row:text-bone-400",
      )}
    >
      <Trash2 aria-hidden className="size-4 shrink-0" strokeWidth={1.7} />
      {armed && <span>Remover</span>}
    </button>
  );
}

export const StudentRow = memo(function StudentRow({
  student,
  position,
  issues,
  highlighted,
  onRename,
  onGraduation,
  onConfirm,
  onRemove,
}: StudentRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasError = issues?.some((issue) => issue.severity === "error") ?? false;
  const hasWarning = !hasError && (issues?.length ?? 0) > 0;
  const confirmable = issues?.some((issue) => issue.severity === "warning");

  const commit = () => {
    const value = cleanPersonName(inputRef.current?.value ?? "");
    if (inputRef.current) inputRef.current.value = value;
    if (value !== student.name) onRename(student.id, value);
  };

  return (
    <li
      data-student-id={student.id}
      className={cn(
        "group/row relative grid grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-x-2 sm:gap-x-3 gap-y-2 border-b border-line py-3 pl-3 pr-1 sm:grid-cols-[44px_minmax(0,1fr)_minmax(200px,280px)_auto] sm:pl-4",
        highlighted && "animate-flash",
        hasError && "bg-signal-900/20",
      )}
    >
      {(hasError || hasWarning) && (
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[2px]", hasError ? "bg-signal-500" : "bg-amber-400/80")} />
      )}

      <span
        className="pt-2.5 font-mono text-[11.5px] tabular-nums text-bone-600"
        title={student.sourceRow ? `Linha ${student.sourceRow} do arquivo` : "Adicionado manualmente"}
      >
        {String(position).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <input
          ref={inputRef}
          key={student.name}
          defaultValue={student.name}
          aria-label={`Nome do aluno ${position}`}
          aria-invalid={hasError || undefined}
          placeholder="Nome completo"
          spellCheck={false}
          autoComplete="off"
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.currentTarget.value = student.name;
              event.currentTarget.blur();
            }
          }}
          className="h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-[14px] font-medium sm:px-2.5 sm:text-[15px] tracking-[-0.005em] text-bone-50 placeholder:text-bone-600 transition-colors hover:border-line-strong hover:bg-ink-850 focus:border-bone-500 focus:bg-ink-850 focus:outline-none"
        />
        {issues && issues.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 px-2.5">
            {issues.map((issue) => (
              <li
                key={issue.code}
                className={cn(
                  "flex items-start gap-2 text-[12.5px] leading-snug",
                  issue.severity === "error" ? "text-signal-300" : "text-amber-300",
                )}
              >
                {issue.severity === "error" ? (
                  <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                )}
                {issue.message}
              </li>
            ))}
            {confirmable && !hasError && (
              <li>
                <button
                  type="button"
                  onClick={() => onConfirm(student.id)}
                  className="mt-0.5 text-[12.5px] font-medium text-bone-300 underline decoration-bone-600 underline-offset-4 hover:text-bone-50 hover:decoration-bone-300"
                >
                  Está correto
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
        <Select
          size="sm"
          aria-label={`Graduação de ${student.name || "aluno sem nome"}`}
          aria-invalid={!student.graduation || undefined}
          value={student.graduation}
          placeholder="Escolher graduação"
          options={OPTIONS}
          onValueChange={(value) => onGraduation(student.id, value)}
          triggerClassName={cn(!student.graduation && "border-signal-500/50 text-signal-300")}
        />
      </div>

      <div className="col-start-3 row-start-1 flex justify-end sm:col-start-4">
        <RemoveButton name={student.name} onRemove={() => onRemove(student.id)} />
      </div>
    </li>
  );
});
