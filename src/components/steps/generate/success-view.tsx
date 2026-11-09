"use client";

import { ArrowLeft, Download, Printer, RotateCcw, TriangleAlert } from "lucide-react";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { KruangChip } from "@/components/ui/kruang-chip";
import { formatBytes } from "@/lib/browser/download";
import { GRADUATIONS } from "@/lib/graduations/catalog";
import type { BatchResult } from "@/lib/pdf/batch";

function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, value, {
      duration: Math.min(1.6, 0.6 + value * 0.012),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, reduced]);
  return <span className="tabular-nums">{reduced ? value : shown}</span>;
}

type SuccessViewProps = {
  result: BatchResult;
  elapsedMs: number;
  /** Graduation name when only that graduation was generated. */
  scopeLabel: string | null;
  onDownloadZip: () => void;
  onDownloadCombined: () => void;
  onBack: () => void;
  onNewClass: () => void;
};

export function SuccessView({ result, elapsedMs, scopeLabel, onDownloadZip, onDownloadCombined, onBack, onNewClass }: SuccessViewProps) {
  const seconds = (elapsedMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <motion.section
      aria-labelledby="sucesso-titulo"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-1 flex-col items-center justify-center py-14 text-center"
    >
      <div aria-hidden className="flex flex-wrap justify-center gap-2.5">
        {GRADUATIONS.map((graduation, index) => (
          <motion.span
            key={graduation.id}
            initial={{ opacity: 0, y: 14, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 + index * 0.06, type: "spring", stiffness: 420, damping: 22 }}
          >
            <KruangChip graduationId={graduation.id} size="lg" />
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <p className="eyebrow mt-14">
          Concluído em {seconds} s{scopeLabel ? ` · ${scopeLabel}` : ""}
        </p>
        <h2 id="sucesso-titulo" tabIndex={-1} className="display mt-6 text-[clamp(3rem,8.5vw,7rem)]">
          <CountUp value={result.count} /> {result.count === 1 ? "certificado" : "certificados"}
          <br />
          <em>{result.count === 1 ? "pronto" : "prontos"}.</em>
        </h2>
        <p className="mt-7 max-w-[52ch] text-[16px] leading-relaxed text-bone-400">
          Um arquivo por aluno, com nomes como <span className="font-mono text-[14px] text-bone-200">certificado-maria-oliveira.pdf</span>,
          e um PDF único com todas as páginas, pronto para mandar para a gráfica.
        </p>

        <div className="mt-11 flex flex-col items-stretch gap-3 sm:flex-row">
          <Button variant="signal" size="lg" icon={<Download className="size-4" />} onClick={onDownloadZip}>
            Baixar ZIP · {result.count} PDFs · {formatBytes(result.zip.byteLength)}
          </Button>
          <Button variant="secondary" size="lg" icon={<Printer className="size-4" />} onClick={onDownloadCombined}>
            PDF único para impressão · {formatBytes(result.combined.byteLength)}
          </Button>
        </div>

        {result.overflow.length > 0 && (
          <p role="status" className="mt-8 flex max-w-[60ch] items-start gap-3 text-left text-[14px] text-amber-300">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Em {result.overflow.length === 1 ? "1 certificado" : `${result.overflow.length} certificados`} o texto não coube no espaço
              mesmo no tamanho mínimo: {result.overflow.slice(0, 3).join(", ")}
              {result.overflow.length > 3 ? "…" : ""}. Confira na prévia.
            </span>
          </p>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            Voltar à prévia
          </Button>
          <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={onNewClass}>
            Começar outra turma
          </Button>
        </div>
      </motion.div>
    </motion.section>
  );
}
