"use client";

import { FileUp, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CalibrationDialog } from "@/components/calibration/calibration-dialog";
import { LiveCertificate } from "@/components/preview/live-certificate";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CertificateValues } from "@/lib/pdf/template";
import { useTemplate } from "@/state/template";

export function TemplatePanel({ values, sampleName }: { values: CertificateValues | null; sampleName: string | null }) {
  const template = useTemplate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      await template.uploadTemplate(file);
      setCalibrating(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível usar este PDF.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside aria-labelledby="modelo-titulo" className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-10 xl:self-start">
      <div className="flex min-w-0 items-baseline justify-between gap-4">
        <h2 id="modelo-titulo" className="eyebrow shrink-0">
          Modelo do certificado
        </h2>
        {sampleName && <span className="min-w-0 truncate text-[12.5px] text-bone-500">Exemplo: {sampleName}</span>}
      </div>

      <div className="rounded-2xl border border-line bg-ink-900/70 p-3 sm:p-4">
        <LiveCertificate values={values} label={`Prévia do certificado${sampleName ? ` de ${sampleName}` : ""}`} />
      </div>

      {template.options.length > 1 && (
        <div role="radiogroup" aria-label="Modelo" className="grid gap-2">
          {template.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === template.active.id}
              onClick={() => template.selectTemplate(option.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                option.id === template.active.id
                  ? "border-bone-400 bg-ink-850"
                  : "border-line-strong hover:border-bone-600",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-3.5 rounded-full border",
                  option.id === template.active.id ? "border-signal-500 bg-signal-500 shadow-[0_0_0_3px_rgb(233_31_38/0.2)]" : "border-bone-500",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-bone-50">{option.name}</span>
                <span className="block truncate text-[12.5px] text-bone-500">{option.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-medium text-bone-100">{template.active.name}</p>
        <p className="text-[13px] text-bone-500">
          {template.active.description}
          {template.isLayoutCustomized ? " · posições ajustadas" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<SlidersHorizontal className="size-3.5" />}
          onClick={() => setCalibrating(true)}
          disabled={template.status !== "ready"}
        >
          Ajustar posições
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<FileUp className="size-3.5" />}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Abrindo PDF…" : "Usar outro PDF"}
        </Button>
        {template.active.custom && (
          <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmRemove(true)}>
            Remover modelo enviado
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {uploadError && (
        <p role="alert" className="text-[13px] text-signal-300">
          {uploadError}
        </p>
      )}
      <p className="text-[12.5px] leading-relaxed text-bone-600">
        O PDF do modelo fica guardado apenas neste navegador. Para outro modelo, envie o certificado exportado em PDF com os campos de nome
        e graduação em branco.
      </p>

      {calibrating && <CalibrationDialog open={calibrating} onOpenChange={setCalibrating} values={values} />}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remover o modelo enviado?"
        description="O PDF enviado e as posições ajustadas para ele serão apagados deste navegador. O modelo original continua disponível."
        confirmLabel="Remover modelo"
        destructive
        onConfirm={() => void template.removeCustomTemplate()}
      />
    </aside>
  );
}
