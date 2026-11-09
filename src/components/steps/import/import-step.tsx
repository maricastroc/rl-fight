"use client";

import { ArrowRight, Check, CircleAlert, FileClock, Loader2, PenLine } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { StepHeader } from "@/components/app/step-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatBytes } from "@/lib/browser/download";
import { interpretSource, readSource, type InterpretedSource } from "@/lib/import/import-file";
import { ImportError, type ExtractedSource } from "@/lib/import/types";
import { studentsFromImport } from "@/lib/students/model";
import { useSession, type ImportMeta } from "@/state/session";
import { DropZone } from "./drop-zone";
import { FormatGuide } from "./format-guide";
import { ImportResult } from "./import-result";

type FileInfo = { name: string; size: number };

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; file: FileInfo; stage: number }
  | { kind: "error"; file: FileInfo; message: string }
  | { kind: "ready"; file: FileInfo; source: ExtractedSource; result: InterpretedSource };

const STAGES = ["Lendo o arquivo", "Identificando alunos e graduações", "Conferindo totais e pendências"];
const MIN_PROCESSING_MS = 650;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function relativeTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `hoje às ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `ontem às ${time}`;
  return `em ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${time}`;
}

function Processing({ file, stage }: { file: FileInfo; stage: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-90 flex-col justify-center rounded-2xl border border-line-strong bg-ink-900/70 px-8 py-10 sm:px-12"
    >
      <p className="truncate text-[15px] font-medium text-bone-50">{file.name}</p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-bone-500">{formatBytes(file.size)}</p>
      <div className="relative mt-8 h-px overflow-hidden bg-line-strong">
        <span className="absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-linear-to-r from-transparent via-signal-500 to-transparent" />
      </div>
      <ol className="mt-8 flex flex-col gap-4">
        {STAGES.map((label, index) => {
          const done = index < stage;
          const current = index === stage;
          return (
            <li key={label} className={cn("flex items-center gap-3.5 text-[14.5px]", done || current ? "text-bone-100" : "text-bone-600")}>
              <span className="grid size-5 place-items-center">
                {done ? (
                  <Check aria-hidden className="size-4 text-bone-200" />
                ) : current ? (
                  <Loader2 aria-hidden className="size-4 animate-spin text-signal-400" />
                ) : (
                  <span aria-hidden className="size-1.5 rounded-full bg-ink-600" />
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ImportFailure({ file, message, onRetry }: { file: FileInfo; message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-90 flex-col justify-center rounded-2xl border border-signal-500/30 bg-signal-900/15 px-8 py-10 sm:px-12">
      <CircleAlert aria-hidden className="size-7 text-signal-400" strokeWidth={1.6} />
      <p className="mt-6 font-display text-2xl font-[720] tracking-[-0.02em] text-bone-50 font-stretch-108%">
        Não deu para ler este arquivo
      </p>
      <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-bone-300">{message}</p>
      <p className="mt-2 truncate font-mono text-[11px] text-bone-500">{file.name}</p>
      <div className="mt-8">
        <Button variant="primary" onClick={onRetry}>
          Tentar outro arquivo
        </Button>
      </div>
    </div>
  );
}

export function ImportStep() {
  const { state, dispatch, saved, resume, discardSaved } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pendingCommit, setPendingCommit] = useState<(() => void) | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const runId = useRef(0);

  async function handleFile(file: File) {
    const id = ++runId.current;
    const info = { name: file.name, size: file.size };
    const started = performance.now();
    setPhase({ kind: "reading", file: info, stage: 0 });
    try {
      const source = await readSource(file);
      if (id !== runId.current) return;
      setPhase({ kind: "reading", file: info, stage: 1 });
      await wait(120);
      const result = interpretSource(source);
      if (id !== runId.current) return;
      setPhase({ kind: "reading", file: info, stage: 2 });
      await wait(Math.max(0, MIN_PROCESSING_MS - (performance.now() - started)));
      if (id !== runId.current) return;
      setPhase({ kind: "ready", file: info, source, result });
    } catch (error) {
      if (id !== runId.current) return;
      const message =
        error instanceof ImportError ? error.message : "Ocorreu um erro inesperado ao ler o arquivo. Tente salvá-lo novamente.";
      setPhase({ kind: "error", file: info, message });
    }
  }

  const handleFileRef = useRef(handleFile);
  useEffect(() => {
    handleFileRef.current = handleFile;
  });

  useEffect(() => {
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files[0];
      if (file) handleFileRef.current(file);
    };
    window.addEventListener("drop", onDrop);
    return () => window.removeEventListener("drop", onDrop);
  }, []);

  function guardedCommit(apply: () => void) {
    const replacing = state.students.length > 0 || saved !== null;
    if (replacing) setPendingCommit(() => apply);
    else apply();
  }

  function commitImport(ready: Extract<Phase, { kind: "ready" }>) {
    guardedCommit(() => {
      const { interpretation, sheets, sheetIndex } = ready.result;
      const meta: ImportMeta = {
        fileName: ready.file.name,
        format: ready.source.format,
        size: ready.file.size,
        sheetName: sheets.length > 1 ? sheets[sheetIndex].name : null,
        structure: interpretation.structure,
        summary: interpretation.summary,
        notes: interpretation.notes,
        importedAt: Date.now(),
      };
      dispatch({ type: "import", students: studentsFromImport(interpretation.students), meta });
      discardSaved();
    });
  }

  function startManual() {
    guardedCommit(() => {
      dispatch({
        type: "import",
        students: [],
        meta: {
          fileName: "Lista digitada",
          format: "manual",
          size: 0,
          sheetName: null,
          structure: "empty",
          summary: null,
          notes: [],
          importedAt: Date.now(),
        },
      });
      discardSaved();
    });
  }

  const reinterpret = (sheetIndex: number, columns?: { nameColumn: number; graduationColumn: number }) => {
    if (phase.kind !== "ready") return;
    setPhase({ ...phase, result: interpretSource(phase.source, sheetIndex, columns ? { columns } : undefined) });
  };

  return (
    <div className="flex flex-1 flex-col pb-16">
      <StepHeader
        number="01"
        title={
          <>
            Da lista ao <em>certificado</em>.
          </>
        }
        lede="Envie a lista de alunos aptos do jeito que você já costuma montar, no Word, no Excel ou em CSV. Os nomes e as graduações são identificados automaticamente."
      />

      <AnimatePresence initial={false}>
        {saved && phase.kind === "idle" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-line-strong bg-ink-850 px-6 py-5">
              <FileClock aria-hidden className="size-5 text-bone-300" strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-bone-50">Você tem uma lista em andamento</p>
                <p className="mt-1 truncate text-[13.5px] text-bone-400">
                  {saved.importMeta?.format === "manual" ? "Lista digitada" : saved.importMeta?.fileName} ·{" "}
                  {saved.students.length} {saved.students.length === 1 ? "aluno" : "alunos"} · editada {relativeTime(saved.updatedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(true)}>
                  Descartar
                </Button>
                <Button variant="primary" size="sm" onClick={resume} trailingIcon={<ArrowRight className="size-3.5" />}>
                  Continuar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state.importMeta && phase.kind === "idle" && (
        <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-line-strong bg-ink-850 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-bone-50">Lista atual: {state.importMeta.fileName}</p>
            <p className="mt-1 text-[13.5px] text-bone-400">
              {state.students.length} {state.students.length === 1 ? "aluno" : "alunos"}. Envie outro arquivo abaixo para substituí-la.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => dispatch({ type: "step", step: "review" })}
            trailingIcon={<ArrowRight className="size-3.5" />}
          >
            Voltar à conferência
          </Button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase.kind}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {phase.kind === "idle" && <DropZone onFile={handleFile} />}
              {phase.kind === "reading" && <Processing file={phase.file} stage={phase.stage} />}
              {phase.kind === "error" && (
                <ImportFailure file={phase.file} message={phase.message} onRetry={() => setPhase({ kind: "idle" })} />
              )}
              {phase.kind === "ready" && (
                <ImportResult
                  file={phase.file}
                  format={phase.source.format}
                  result={phase.result}
                  onSheetChange={(index) => reinterpret(index)}
                  onColumnsChange={(columns) => reinterpret(phase.result.sheetIndex, columns)}
                  onReplace={() => setPhase({ kind: "idle" })}
                  onContinue={() => commitImport(phase)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {phase.kind === "idle" && (
            <button
              type="button"
              onClick={startManual}
              className="group mt-6 inline-flex items-center gap-2.5 text-[14px] text-bone-400 transition-colors hover:text-bone-50"
            >
              <PenLine aria-hidden className="size-4" strokeWidth={1.7} />
              Prefere digitar os nomes? Começar uma lista vazia
              <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        <FormatGuide />
      </div>

      <ConfirmDialog
        open={pendingCommit !== null}
        onOpenChange={(open) => !open && setPendingCommit(null)}
        title="Substituir a lista atual?"
        description="A lista em andamento e as correções feitas nela serão descartadas. Esta ação não pode ser desfeita."
        confirmLabel="Substituir lista"
        destructive
        onConfirm={() => {
          pendingCommit?.();
          setPendingCommit(null);
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Descartar a lista em andamento?"
        description="Os alunos e as correções salvas neste navegador serão apagados. Esta ação não pode ser desfeita."
        confirmLabel="Descartar"
        destructive
        onConfirm={discardSaved}
      />
    </div>
  );
}
