"use client";

import { Check, LockKeyhole } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { formatExamDate } from "@/lib/certificate/config";
import { STEPS, useSession, useSessionInsights, type Step } from "@/state/session";
import { Brand } from "./brand";

function useStepStatus() {
  const { state } = useSession();
  const insights = useSessionInsights();
  const { importMeta, students, config } = state;

  const available: Record<Step, boolean> = {
    import: true,
    review: insights.canReview,
    configure: insights.canConfigure,
    generate: insights.canGenerate,
  };

  const blockedReason: Record<Step, string> = {
    import: "",
    review: "Importe uma lista primeiro",
    configure: insights.canReview
      ? students.length === 0
        ? "Adicione pelo menos um aluno"
        : "Resolva as pendências da conferência"
      : "Importe uma lista primeiro",
    generate: insights.canConfigure ? "Informe a data e o local do exame" : "Conclua as etapas anteriores",
  };

  const date = formatExamDate(config.examDate, "numeric");
  const detail: Record<Step, string> = {
    import: importMeta ? (importMeta.format === "manual" ? "Lista digitada" : importMeta.fileName) : "DOCX, XLSX ou CSV",
    review: importMeta
      ? `${students.length} ${students.length === 1 ? "aluno" : "alunos"}${insights.errors ? ` · ${insights.errors} pendente${insights.errors > 1 ? "s" : ""}` : ""}`
      : "Nomes e graduações",
    configure: date ? `${date} · ${config.city || "sem cidade"}` : "Data e local do exame",
    generate: "Prévia e download",
  };

  return { available, blockedReason, detail };
}

function useGoToStep() {
  const { dispatch } = useSession();
  const { available } = useStepStatus();
  return (step: Step) => {
    if (available[step]) dispatch({ type: "step", step });
  };
}

export function StepRail() {
  const { state } = useSession();
  const { available, blockedReason, detail } = useStepStatus();
  const goTo = useGoToStep();
  const activeIndex = STEPS.findIndex((s) => s.id === state.step);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[280px] shrink-0 flex-col border-r border-line px-8 pb-8 pt-9 lg:flex">
      <Brand />

      <nav aria-label="Etapas" className="mt-16">
        <ol className="relative">
          <span aria-hidden className="absolute bottom-6 left-[5px] top-6 w-px bg-line-strong" />
          <motion.span
            aria-hidden
            className="absolute bottom-6 left-[5px] top-6 w-px origin-top bg-signal-500"
            initial={false}
            animate={{ scaleY: activeIndex / (STEPS.length - 1) }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          {STEPS.map((step, index) => {
            const active = step.id === state.step;
            const done = index < activeIndex;
            const locked = !available[step.id];
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => goTo(step.id)}
                  aria-current={active ? "step" : undefined}
                  aria-disabled={locked || undefined}
                  title={locked ? blockedReason[step.id] : undefined}
                  className={cn(
                    "group relative flex w-full items-start gap-5 rounded-lg py-3.5 text-left",
                    locked ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 mt-[5px] grid size-[11px] place-items-center rounded-full border transition-all duration-300",
                      active && "border-signal-500 bg-signal-500 shadow-[0_0_0_5px_rgb(233_31_38/0.16)]",
                      done && "border-bone-300 bg-bone-300",
                      !active && !done && (locked ? "border-ink-600 bg-ink-950" : "border-bone-500 bg-ink-950"),
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-baseline gap-2.5">
                      <span className={cn("font-mono text-[11px] tabular-nums", active ? "text-signal-400" : "text-bone-600")}>
                        {step.number}
                      </span>
                      <span
                        className={cn(
                          "font-display text-[15.5px] font-[650] tracking-[-0.015em] transition-colors [font-stretch:108%]",
                          active ? "text-bone-50" : locked ? "text-bone-600" : "text-bone-300 group-hover:text-bone-50",
                        )}
                      >
                        {step.label}
                      </span>
                      {done && <Check aria-hidden className="size-3.5 text-bone-500" />}
                      {locked && <LockKeyhole aria-hidden className="size-3 text-bone-600" />}
                    </span>
                    <span className={cn("mt-1 max-w-[190px] truncate text-[12.5px]", active ? "text-bone-400" : "text-bone-600")}>
                      {detail[step.id]}
                    </span>
                    {locked && <span className="sr-only">Indisponível: {blockedReason[step.id]}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="mt-auto flex gap-3 border-t border-line pt-6 text-[12.5px] leading-relaxed text-bone-500">
        <LockKeyhole aria-hidden className="mt-0.5 size-3.5 shrink-0 text-bone-600" />
        Tudo é processado neste navegador. Nenhum nome de aluno é enviado para a internet.
      </p>
    </aside>
  );
}

export function MobileHeader() {
  const { state } = useSession();
  const { available } = useStepStatus();
  const goTo = useGoToStep();
  const activeIndex = STEPS.findIndex((s) => s.id === state.step);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-950/85 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-4 sm:px-8">
        <Brand compact />
        <span className="font-mono text-[11px] tracking-[0.14em] text-bone-500">
          {STEPS[activeIndex].number} / 04
        </span>
      </div>
      <nav aria-label="Etapas" className="grid grid-cols-4 gap-1.5 px-4 pb-3 sm:px-8">
        {STEPS.map((step, index) => {
          const active = index === activeIndex;
          const locked = !available[step.id];
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => goTo(step.id)}
              aria-current={active ? "step" : undefined}
              aria-disabled={locked || undefined}
              className="flex flex-col gap-1.5 text-left"
            >
              <span
                className={cn(
                  "h-[3px] rounded-full transition-colors duration-300",
                  active ? "bg-signal-500" : index < activeIndex ? "bg-bone-400" : "bg-ink-700",
                )}
              />
              <span className={cn("text-[11.5px] font-medium", active ? "text-bone-50" : locked ? "text-bone-600" : "text-bone-400")}>
                {step.label}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
