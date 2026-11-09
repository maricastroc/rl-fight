"use client";

import { ArrowDownToLine, FileUp } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/cn";

const ACCEPTED_FILES = ".docx,.xlsx,.xlsm,.csv,.txt,.tsv";

/** Printer's crop marks framing the drop area; they tighten and turn red while a file hovers. */
function CropMarks({ active }: { active: boolean }) {
  const corner = "absolute size-5 transition-all duration-300 ease-[var(--ease-out-expo)]";
  const color = active ? "border-signal-500" : "border-bone-600 group-hover:border-bone-400";
  const inset = active ? "10px" : "18px";
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className={cn(corner, color, "border-l border-t")} style={{ left: inset, top: inset }} />
      <span className={cn(corner, color, "border-r border-t")} style={{ right: inset, top: inset }} />
      <span className={cn(corner, color, "border-b border-l")} style={{ left: inset, bottom: inset }} />
      <span className={cn(corner, color, "border-b border-r")} style={{ right: inset, bottom: inset }} />
    </span>
  );
}

export function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes("Files");

  const onDragEnter = (event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    depth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Escolher o arquivo com a lista de alunos"
      aria-describedby="formatos-aceitos"
      onClick={() => inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={(event) => isFileDrag(event) && event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-dragging={dragging || undefined}
      className={cn(
        "group relative grid min-h-[360px] cursor-pointer place-items-center overflow-hidden rounded-2xl border transition-[background-color,border-color] duration-300",
        dragging ? "border-signal-500/40 bg-signal-900/25" : "border-line bg-ink-900/55 hover:border-line-strong hover:bg-ink-900",
      )}
    >
      <CropMarks active={dragging} />
      <div
        aria-hidden
        className={cn(
          "hairline-grid pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 [mask-image:radial-gradient(closest-side,black,transparent)]",
          dragging ? "opacity-100" : "group-hover:opacity-60",
        )}
      />

      <div className="relative flex flex-col items-center px-6 py-14 text-center">
        <motion.span
          animate={dragging ? { y: -6, scale: 1.06 } : { y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className={cn(
            "grid size-16 place-items-center rounded-full border transition-colors duration-300",
            dragging ? "border-signal-500 bg-signal-500 text-white" : "border-line-strong bg-ink-850 text-bone-200",
          )}
        >
          {dragging ? <ArrowDownToLine className="size-6" /> : <FileUp className="size-6" strokeWidth={1.6} />}
        </motion.span>

        <p className="mt-7 font-display text-[clamp(1.5rem,3vw,2rem)] font-[720] tracking-[-0.025em] text-bone-50 [font-stretch:110%]">
          {dragging ? "Solte para importar" : "Arraste a lista para cá"}
        </p>
        <p className="mt-3 text-[15px] text-bone-400">
          ou{" "}
          <span className="text-bone-100 underline decoration-bone-600 underline-offset-4 transition-colors group-hover:decoration-signal-500">
            escolha um arquivo
          </span>{" "}
          no computador
        </p>

        <p id="formatos-aceitos" className="mt-9 flex items-center gap-2">
          <span className="sr-only">Formatos aceitos:</span>
          {["DOCX", "XLSX", "CSV"].map((format) => (
            <span
              key={format}
              className="rounded-md border border-line-strong px-2 py-1 font-mono text-[10.5px] tracking-[0.14em] text-bone-400"
            >
              {format}
            </span>
          ))}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        data-testid="file-input"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
