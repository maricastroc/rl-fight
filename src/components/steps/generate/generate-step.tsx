"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Download, Info, Maximize2, Minus, Plus, Search, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StepHeader } from "@/components/app/step-layout";
import { LiveCertificate } from "@/components/preview/live-certificate";
import { useElementSize } from "@/components/preview/use-element-size";
import { graduationOptions } from "@/components/students/graduation-options";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KruangChip } from "@/components/ui/kruang-chip";
import { Select } from "@/components/ui/select";
import { loadFontsFor } from "@/lib/browser/assets";
import { downloadBytes } from "@/lib/browser/download";
import { BatchCancelled, runBatch } from "@/lib/browser/run-batch";
import { certificateValues } from "@/lib/certificate/values";
import { getGraduation } from "@/lib/graduations/catalog";
import type { BatchProgress, BatchResult } from "@/lib/pdf/batch";
import { uniqueCertificateFileNames } from "@/lib/pdf/filenames";
import { countByGraduation, orderForCertificates, type Student } from "@/lib/students/model";
import { foldKey } from "@/lib/text/normalize";
import { slugify } from "@/lib/text/slug";
import { useSession } from "@/state/session";
import { useTemplate } from "@/state/template";
import type { PreviewState } from "@/state/use-certificate-preview";
import { SuccessView } from "./success-view";

/** Which students a batch covers: the whole class or one graduation. */
type BatchScope = { graduationId: string | null };

type RunState =
  | { kind: "idle" }
  | { kind: "running"; progress: BatchProgress; total: number; cancel: () => void }
  | { kind: "done"; result: BatchResult; elapsedMs: number; scope: BatchScope }
  | { kind: "error"; message: string };

const ALL = "__all__";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const CSS_PX_PER_PT = 96 / 72;

function progressLabel(progress: BatchProgress): string {
  if (progress.phase === "certificates") return progress.current ? `Certificado de ${progress.current}` : "Preparando…";
  if (progress.phase === "combined") return "Montando o PDF único para impressão";
  return "Compactando o arquivo ZIP";
}

function progressFraction(progress: BatchProgress, total: number): number {
  if (progress.phase === "certificates") return (progress.done / Math.max(1, total)) * 0.86;
  if (progress.phase === "combined") return 0.86 + (progress.done / Math.max(1, total)) * 0.08;
  return 0.94 + (progress.percent / 100) * 0.06;
}

export function GenerateStep() {
  const { state, dispatch } = useSession();
  const template = useTemplate();
  const ordered = useMemo(() => orderForCertificates(state.students), [state.students]);
  const fileNames = useMemo(() => {
    const names = uniqueCertificateFileNames(ordered.map((s) => s.name));
    return new Map(ordered.map((student, i) => [student.id, names[i]]));
  }, [ordered]);
  const counts = useMemo(() => countByGraduation(ordered), [ordered]);
  const [graduationFilter, setGraduationFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [query, setQuery] = useState("");
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmNewClass, setConfirmNewClass] = useState(false);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const stageWidth = stage.width;
  const listRef = useRef<HTMLUListElement>(null);

  // Navigation, the counter and the list all follow the graduation filter.
  const visible = useMemo(
    () => (graduationFilter === ALL ? ordered : ordered.filter((student) => student.graduation === graduationFilter)),
    [ordered, graduationFilter],
  );
  const safeIndex = Math.max(0, visible.findIndex((student) => student.id === selectedId));
  const current = visible[safeIndex];
  const filterLabel = graduationFilter === ALL ? null : (getGraduation(graduationFilter)?.label ?? null);
  const values = useMemo(() => (current ? certificateValues(current, state.config) : null), [current, state.config]);
  const page = template.pageSize ?? { width: 841.92, height: 595.32 };
  const fitWidth = Math.max(0, stageWidth);
  const displayWidth = zoom === "fit" ? fitWidth : Math.round(page.width * CSS_PX_PER_PT * zoom);
  const zoomPercent = Math.round((displayWidth / (page.width * CSS_PX_PER_PT)) * 100);
  const running = run.kind === "running";

  const go = useCallback(
    (next: number) => {
      const target = visible[Math.max(0, Math.min(visible.length - 1, next))];
      if (target) setSelectedId(target.id);
    },
    [visible],
  );

  const changeFilter = (value: string) => {
    setGraduationFilter(value);
    const next = value === ALL ? ordered : ordered.filter((student) => student.graduation === value);
    if (current && !next.some((student) => student.id === current.id)) setSelectedId(next[0]?.id ?? null);
  };

  const filterOptions = useMemo(
    () => [
      { value: ALL, label: "Todas as graduações", detail: String(ordered.length) },
      ...graduationOptions(counts).filter((option) => (counts.get(option.value) ?? 0) > 0),
    ],
    [counts, ordered.length],
  );

  const changeZoom = useCallback(
    (direction: 1 | -1) => {
      const currentZoom = zoomPercent / 100;
      const next =
        direction > 0 ? ZOOM_STEPS.find((z) => z > currentZoom + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < currentZoom - 0.01);
      if (next) setZoom(next);
    },
    [zoomPercent],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.closest("[role=dialog]")) return;
      if (event.key === "ArrowRight") go(safeIndex + 1);
      else if (event.key === "ArrowLeft") go(safeIndex - 1);
      else if (event.key === "+" || event.key === "=") changeZoom(1);
      else if (event.key === "-") changeZoom(-1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, safeIndex, changeZoom]);

  useEffect(() => {
    if (current) listRef.current?.querySelector(`[data-student="${current.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const downloadCurrent = async () => {
    if (!template.engine || !values || !current) return;
    setDownloading(true);
    try {
      const fonts = await loadFontsFor(template.layout);
      const rendered = await template.engine.render(values, template.layout, fonts);
      downloadBytes(fileNames.get(current.id) ?? "certificado.pdf", rendered.bytes, "application/pdf");
    } finally {
      setDownloading(false);
    }
  };

  const generate = async (students: Student[], scope: BatchScope) => {
    if (!template.bytes) return;
    const started = performance.now();
    const total = students.length;
    let handle: ReturnType<typeof runBatch> | null = null;
    setRun({ kind: "running", progress: { phase: "certificates", done: 0, total, current: "" }, total, cancel: () => handle?.cancel() });
    try {
      const fonts = await loadFontsFor(template.layout);
      const items = students.map((student) => ({
        values: certificateValues(student, state.config),
        fileName: fileNames.get(student.id) ?? "certificado.pdf",
      }));
      handle = runBatch({ templateBytes: template.bytes, fonts, layout: template.layout, items }, (progress) =>
        setRun((previous) => (previous.kind === "running" ? { ...previous, progress } : previous)),
      );
      const result = await handle.promise;
      setRun({ kind: "done", result, elapsedMs: performance.now() - started, scope });
    } catch (error) {
      if (error instanceof BatchCancelled) setRun({ kind: "idle" });
      else setRun({ kind: "error", message: error instanceof Error ? error.message : "Falha ao gerar os certificados." });
    }
  };

  if (run.kind === "done") {
    const scopeLabel = getGraduation(run.scope.graduationId)?.label ?? null;
    const filesStem = [`certificados-${state.config.examDate || "turma"}`, scopeLabel && slugify(scopeLabel)].filter(Boolean).join("-");
    return (
      <div className="flex flex-1 flex-col pb-10">
        <SuccessView
          result={run.result}
          elapsedMs={run.elapsedMs}
          scopeLabel={scopeLabel}
          onDownloadZip={() => downloadBytes(`${filesStem}.zip`, run.result.zip, "application/zip")}
          onDownloadCombined={() => downloadBytes(`${filesStem}-impressao.pdf`, run.result.combined, "application/pdf")}
          onBack={() => setRun({ kind: "idle" })}
          onNewClass={() => setConfirmNewClass(true)}
        />
        <ConfirmDialog
          open={confirmNewClass}
          onOpenChange={setConfirmNewClass}
          title="Começar outra turma?"
          description="A lista atual será apagada deste navegador. Baixe os arquivos antes, se ainda não baixou."
          confirmLabel="Começar outra turma"
          destructive
          onConfirm={() => dispatch({ type: "reset" })}
        />
      </div>
    );
  }

  const fieldNotes =
    preview?.fields.filter((field) => field.shrunk || field.overflow).map((field) => ({
      ...field,
      label: template.layout.fields.find((f) => f.id === field.fieldId)?.label ?? field.fieldId,
    })) ?? [];

  const needle = foldKey(query);
  const listed = visible.map((student, i) => ({ student, i })).filter(({ student }) => !needle || foldKey(student.name).includes(needle));
  const graduation = getGraduation(current?.graduation);

  return (
    <div className="flex flex-1 flex-col pb-16">
      <StepHeader
        number="04"
        title={
          <>
            Pronto para <em>imprimir</em>.
          </>
        }
        lede="Esta é a prévia exata de cada PDF. Navegue pelos alunos com as setas do teclado e gere todos os certificados de uma vez."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-12">
        <section aria-label="Prévia do certificado" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <IconButton label="Certificado anterior" onClick={() => go(safeIndex - 1)} disabled={safeIndex === 0}>
                <ChevronLeft className="size-5" />
              </IconButton>
              <span className="min-w-[78px] text-center font-mono text-[13px] tabular-nums text-bone-300" aria-live="polite">
                {safeIndex + 1} <span className="text-bone-600">/ {visible.length}</span>
              </span>
              <IconButton label="Próximo certificado" onClick={() => go(safeIndex + 1)} disabled={safeIndex >= visible.length - 1}>
                <ChevronRight className="size-5" />
              </IconButton>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Diminuir zoom" onClick={() => changeZoom(-1)} disabled={zoomPercent <= 50}>
                <Minus className="size-4" />
              </IconButton>
              <span className="min-w-[52px] text-center font-mono text-[12.5px] tabular-nums text-bone-400">{zoomPercent}%</span>
              <IconButton label="Aumentar zoom" onClick={() => changeZoom(1)} disabled={zoomPercent >= 200}>
                <Plus className="size-4" />
              </IconButton>
              <Button
                variant={zoom === "fit" ? "secondary" : "ghost"}
                size="sm"
                className="ml-1"
                aria-pressed={zoom === "fit"}
                icon={<Maximize2 className="size-3.5" />}
                onClick={() => setZoom("fit")}
              >
                Ajustar à largura
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-ink-900/60">
            <div className="max-h-[78vh] overflow-auto p-3 sm:p-6">
              <div ref={stageRef} className="w-full" />
              <div style={{ width: displayWidth || undefined }} className="mx-auto">
                <LiveCertificate
                  values={values}
                  width={displayWidth}
                  label={current ? `Certificado de ${values?.nome}, ${graduation?.label ?? ""}` : "Certificado"}
                  onPreview={setPreview}
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-7 xl:sticky xl:top-10 xl:self-start">
          {current && (
            <div>
              <p className="eyebrow truncate">
                Aluno {safeIndex + 1} de {visible.length}
                {filterLabel ? ` · ${filterLabel}` : ""}
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  <p className="mt-4 font-display text-[26px] font-[720] leading-[1.08] tracking-[-0.025em] text-bone-50 [font-stretch:104%]">
                    {values?.nome}
                  </p>
                  <p className="mt-3 flex items-center gap-2.5 text-[14px] text-bone-300">
                    <KruangChip graduationId={current.graduation} />
                    {graduation?.label}
                  </p>
                  <p className="mt-2 truncate font-mono text-[11.5px] text-bone-600">{fileNames.get(current.id)}</p>
                </motion.div>
              </AnimatePresence>

              {fieldNotes.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {fieldNotes.map((note) => (
                    <li
                      key={note.fieldId}
                      className={cn("flex items-start gap-2.5 text-[13px] leading-snug", note.overflow ? "text-amber-300" : "text-bone-500")}
                    >
                      {note.overflow ? (
                        <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                      ) : (
                        <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                      )}
                      {note.overflow
                        ? `${note.label}: o texto não coube no espaço nem no tamanho mínimo. Considere abreviar.`
                        : `${note.label}: fonte reduzida para ${note.size.toLocaleString("pt-BR")} pt para caber no espaço.`}
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="secondary"
                className="mt-5 w-full"
                icon={<Download className="size-4" />}
                onClick={downloadCurrent}
                disabled={!template.engine || downloading || running}
              >
                {downloading ? "Preparando…" : "Baixar este certificado"}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-line pt-6">
            {filterOptions.length > 2 && (
              <Select
                aria-label="Filtrar por graduação"
                value={graduationFilter}
                options={filterOptions}
                onValueChange={changeFilter}
                triggerClassName="h-10 text-[14px]"
              />
            )}
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-bone-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ir para aluno"
                aria-label="Procurar aluno na prévia"
                className="h-9 w-full rounded-lg border border-line-strong bg-ink-900 pl-9 pr-3 text-[13.5px] text-bone-50 placeholder:text-bone-600 focus:border-bone-400 focus:outline-none"
              />
            </div>
            <ul ref={listRef} className="max-h-[300px] overflow-y-auto pr-1" aria-label="Alunos">
              {listed.map(({ student, i }, position) => {
                const startsGroup = position === 0 || listed[position - 1].student.graduation !== student.graduation;
                return (
                  <li key={student.id}>
                    {startsGroup && (
                      <p className="sticky top-0 z-10 flex items-center gap-2.5 bg-ink-950 px-2.5 pb-1.5 pt-3 text-[11.5px] font-medium uppercase tracking-[0.08em] text-bone-500 first:pt-1">
                        <KruangChip graduationId={student.graduation} size="xs" />
                        <span className="truncate">{getGraduation(student.graduation)?.label}</span>
                        <span className="ml-auto font-mono tabular-nums text-bone-600">{counts.get(student.graduation) ?? 0}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      data-student={student.id}
                      onClick={() => go(i)}
                      aria-current={i === safeIndex ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
                        i === safeIndex ? "bg-ink-750 text-bone-50" : "text-bone-400 hover:bg-ink-850 hover:text-bone-100",
                      )}
                    >
                      <span className="w-6 font-mono text-[11px] tabular-nums text-bone-600">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{student.name}</span>
                    </button>
                  </li>
                );
              })}
              {listed.length === 0 && <li className="px-2.5 py-3 text-[13px] text-bone-500">Nenhum aluno com esse nome.</li>}
            </ul>
          </div>

          <div className="border-t border-line pt-6">
            <AnimatePresence mode="wait" initial={false}>
              {run.kind === "running" ? (
                <motion.div
                  key="running"
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col"
                >
                  <p className="eyebrow">Gerando certificados</p>
                  <p className="mt-4 font-display text-[44px] font-[760] leading-none tracking-[-0.04em] tabular-nums text-bone-50">
                    {run.progress.phase === "certificates" ? run.progress.done : run.total}
                    <span className="text-bone-600"> / {run.total}</span>
                  </p>
                  <div className="mt-5 h-1 overflow-hidden rounded-full bg-ink-700">
                    <motion.div
                      className="h-full origin-left rounded-full bg-signal-500"
                      initial={false}
                      animate={{ scaleX: progressFraction(run.progress, run.total) }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-3 truncate text-[13px] text-bone-400">{progressLabel(run.progress)}</p>
                  <Button variant="ghost" size="sm" className="mt-4 self-start" onClick={run.cancel}>
                    Cancelar
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                  <Button
                    variant="signal"
                    size="lg"
                    className="w-full"
                    onClick={() => generate(ordered, { graduationId: null })}
                    disabled={template.status !== "ready" || ordered.length === 0}
                  >
                    Gerar {ordered.length === 1 ? "o certificado" : `os ${ordered.length} certificados`}
                  </Button>
                  {filterLabel && visible.length > 0 && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => generate(visible, { graduationId: graduationFilter })}
                      disabled={template.status !== "ready"}
                    >
                      <span className="truncate">
                        Gerar só {visible.length === 1 ? "o" : `os ${visible.length}`} de {filterLabel}
                      </span>
                    </Button>
                  )}
                  <p className="text-[12.5px] leading-relaxed text-bone-500">
                    Você recebe um ZIP com um PDF por aluno e um PDF único com todas as páginas para impressão.
                  </p>
                  {run.kind === "error" && (
                    <p role="alert" className="text-[13px] text-signal-300">
                      {run.message}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <div className="mt-12">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => dispatch({ type: "step", step: "configure" })} disabled={running}>
          Voltar para os dados do exame
        </Button>
      </div>
    </div>
  );
}
