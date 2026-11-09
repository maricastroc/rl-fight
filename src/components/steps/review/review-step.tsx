"use client";

import { ArrowLeft, ArrowRight, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StepFooter, StepHeader } from "@/components/app/step-layout";
import { DistributionBar, countsInOrder } from "@/components/students/graduation-breakdown";
import { graduationOptions } from "@/components/students/graduation-options";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KruangChip } from "@/components/ui/kruang-chip";
import { Select } from "@/components/ui/select";
import { getGraduation } from "@/lib/graduations/catalog";
import { countByGraduation, createId, groupByGraduation, orderForCertificates } from "@/lib/students/model";
import { foldKey } from "@/lib/text/normalize";
import { useSession, useSessionInsights } from "@/state/session";
import { AddStudentForm } from "./add-student-form";
import { ImportNotes } from "./import-notes";
import { StudentRow } from "./student-row";

const ALL = "__all__";
const UNDEFINED = "__undefined__";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function ReviewStep() {
  const { state, dispatch } = useSession();
  const insights = useSessionInsights();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(ALL);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [adding, setAdding] = useState(state.students.length === 0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { students } = state;
  const counts = useMemo(() => countByGraduation(students), [students]);
  const ordered = useMemo(() => orderForCertificates(students), [students]);
  const positions = useMemo(() => new Map(ordered.map((s, i) => [s.id, i + 1])), [ordered]);

  const visible = useMemo(() => {
    const needle = foldKey(query);
    return students.filter((student) => {
      if (needle && !foldKey(student.name).includes(needle)) return false;
      if (filter === UNDEFINED && getGraduation(student.graduation)) return false;
      if (filter !== ALL && filter !== UNDEFINED && student.graduation !== filter) return false;
      if (onlyIssues && !insights.issues.has(student.id)) return false;
      return true;
    });
  }, [students, query, filter, onlyIssues, insights.issues]);

  const groups = useMemo(() => groupByGraduation(visible), [visible]);
  const breakdown = useMemo(() => countsInOrder(counts), [counts]);
  const undefinedCount = students.filter((s) => !getGraduation(s.graduation)).length;

  const filterOptions = useMemo(
    () => [
      { value: ALL, label: "Todas as graduações", detail: String(students.length) },
      ...(undefinedCount > 0 ? [{ value: UNDEFINED, label: "Sem graduação definida", detail: String(undefinedCount) }] : []),
      ...graduationOptions(counts).filter((option) => (counts.get(option.value) ?? 0) > 0),
    ],
    [counts, students.length, undefinedCount],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), 1600);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const onRename = useCallback((id: string, name: string) => dispatch({ type: "student/update", id, patch: { name } }), [dispatch]);
  const onGraduation = useCallback(
    (id: string, graduation: string) => dispatch({ type: "student/update", id, patch: { graduation } }),
    [dispatch],
  );
  const onConfirm = useCallback((id: string) => dispatch({ type: "student/update", id, patch: { reviewed: true } }), [dispatch]);
  const onRemove = useCallback((id: string) => dispatch({ type: "student/remove", id }), [dispatch]);

  const addStudent = (name: string, graduation: string) => {
    const id = createId();
    dispatch({ type: "student/add", student: { id, name, graduation } });
    setHighlighted(id);
    if (filter !== ALL && filter !== graduation) setFilter(ALL);
  };

  const filtersActive = query !== "" || filter !== ALL || onlyIssues;
  const issueCount = insights.issues.size;

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        number="02"
        title={
          <>
            Confira os <em>alunos</em>.
          </>
        }
        lede="Revise nomes e graduações antes de gerar. Clique em um nome para corrigir; as alterações são salvas automaticamente neste navegador."
      />

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <div>
              <dt className="eyebrow">Alunos</dt>
              <dd className="mt-3 font-display text-[44px] font-[760] leading-none tracking-[-0.04em] tabular-nums text-bone-50 [font-stretch:105%]">
                {students.length}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Graduações</dt>
              <dd className="mt-3 font-display text-[44px] font-[760] leading-none tracking-[-0.04em] tabular-nums text-bone-50 [font-stretch:105%]">
                {insights.graduationCount}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Para revisar</dt>
              <dd
                className={cn(
                  "mt-3 font-display text-[44px] font-[760] leading-none tracking-[-0.04em] tabular-nums [font-stretch:105%]",
                  insights.errors > 0 ? "text-signal-400" : issueCount > 0 ? "text-amber-300" : "text-bone-50",
                )}
              >
                {issueCount}
              </dd>
            </div>
          </dl>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Adicionar aluno
          </Button>
        </div>

        <DistributionBar
          counts={breakdown}
          active={filter === ALL ? null : filter === UNDEFINED ? "" : filter}
          onSelect={(id) => {
            const next = id === "" ? UNDEFINED : id;
            setFilter((current) => (current === next ? ALL : next));
          }}
        />

        <ImportNotes />

        <AnimatePresence initial={false}>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <AddStudentForm
                defaultGraduation={filter !== ALL && filter !== UNDEFINED ? filter : ""}
                onAdd={addStudent}
                onClose={() => setAdding(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-bone-500" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar aluno pelo nome"
              aria-label="Buscar aluno pelo nome"
              className="h-11 w-full rounded-lg border border-line-strong bg-ink-900 pl-10 pr-12 text-[15px] text-bone-50 placeholder:text-bone-600 transition-colors hover:border-bone-600 focus:border-bone-400 focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line-strong px-1.5 font-mono text-[11px] text-bone-500 sm:block">
              /
            </kbd>
          </div>
          <div className="sm:w-[280px]">
            <Select aria-label="Filtrar por graduação" value={filter} options={filterOptions} onValueChange={setFilter} />
          </div>
          <button
            type="button"
            aria-pressed={onlyIssues}
            onClick={() => setOnlyIssues((value) => !value)}
            disabled={issueCount === 0 && !onlyIssues}
            className={cn(
              "h-11 rounded-lg border px-4 text-[14px] font-medium transition-colors disabled:opacity-40",
              onlyIssues
                ? "border-amber-400/60 bg-amber-900/40 text-amber-300"
                : "border-line-strong text-bone-300 hover:border-bone-600 hover:text-bone-50",
            )}
          >
            Só pendências
          </button>
        </div>

        <div aria-live="polite" className="sr-only">
          {filtersActive ? `${plural(visible.length, "aluno encontrado", "alunos encontrados")}` : ""}
        </div>

        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
            <p className="font-display text-2xl font-[720] tracking-[-0.02em] text-bone-50 [font-stretch:108%]">A lista está vazia</p>
            <p className="mx-auto mt-3 max-w-[44ch] text-[15px] text-bone-400">
              Adicione os alunos um a um pelo formulário acima, ou volte e importe um arquivo.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="text-[16px] text-bone-200">
              {onlyIssues && issueCount === 0 && !query && filter === ALL
                ? "Tudo revisado — nenhuma pendência restante."
                : "Nenhum aluno corresponde aos filtros."}
            </p>
            <Button
              className="mt-5"
              variant="secondary"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() => {
                setQuery("");
                setFilter(ALL);
                setOnlyIssues(false);
              }}
            >
              {onlyIssues && issueCount === 0 && !query && filter === ALL ? "Mostrar todos" : "Limpar filtros"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {groups.map((group) => {
              const graduation = getGraduation(group.graduationId);
              const total = counts.get(group.graduationId) ?? 0;
              return (
                <section key={group.graduationId || "undefined"} aria-labelledby={`grupo-${group.graduationId || "indefinido"}`}>
                  <header className="sticky top-[104px] z-10 flex items-center gap-4 border-b border-line-strong bg-ink-950/92 py-3 backdrop-blur-sm lg:top-0">
                    <KruangChip graduationId={group.graduationId} size="md" />
                    <h2
                      id={`grupo-${group.graduationId || "indefinido"}`}
                      className={cn(
                        "font-display text-[17px] font-[680] tracking-[-0.015em] [font-stretch:106%]",
                        graduation ? "text-bone-50" : "text-signal-300",
                      )}
                    >
                      {graduation?.label ?? "Sem graduação definida"}
                    </h2>
                    <span className="ml-auto font-mono text-[11.5px] tabular-nums text-bone-500">
                      {group.students.length !== total ? `${group.students.length} de ${total}` : plural(total, "aluno", "alunos")}
                    </span>
                  </header>
                  <ul>
                    {group.students.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        position={positions.get(student.id) ?? 0}
                        issues={insights.issues.get(student.id)}
                        highlighted={highlighted === student.id}
                        onRename={onRename}
                        onGraduation={onGraduation}
                        onConfirm={onConfirm}
                        onRemove={onRemove}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <div className="flex justify-start">
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
            Descartar esta lista e recomeçar
          </Button>
        </div>
      </div>

      <StepFooter>
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => dispatch({ type: "step", step: "import" })}>
            Importar
          </Button>
          <p role="status" className="hidden text-[13.5px] md:block">
            {students.length === 0 ? (
              <span className="text-bone-500">Adicione pelo menos um aluno para continuar.</span>
            ) : insights.errors > 0 ? (
              <span className="text-signal-300">
                {plural(insights.errors, "aluno precisa", "alunos precisam")} de correção antes de gerar.
              </span>
            ) : insights.warnings > 0 ? (
              <span className="text-amber-300">
                {plural(insights.warnings, "aviso", "avisos")} para dar uma olhada — não impedem a geração.
              </span>
            ) : (
              <span className="text-bone-400">Tudo certo com os {plural(students.length, "aluno", "alunos")}.</span>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={!insights.canConfigure}
          onClick={() => dispatch({ type: "step", step: "configure" })}
          trailingIcon={<ArrowRight className="size-4" />}
        >
          Continuar
        </Button>
      </StepFooter>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Descartar a lista?"
        description={`Os ${plural(students.length, "aluno", "alunos")} e todas as correções serão apagados deste navegador. Esta ação não pode ser desfeita.`}
        confirmLabel="Descartar lista"
        destructive
        onConfirm={() => dispatch({ type: "reset" })}
      />
    </div>
  );
}
