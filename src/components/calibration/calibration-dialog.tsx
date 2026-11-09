"use client";

import { Download, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { LiveCertificate } from "@/components/preview/live-certificate";
import { useElementSize } from "@/components/preview/use-element-size";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { inputClass } from "@/components/ui/fields";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { downloadBytes } from "@/lib/browser/download";
import { FONT_IDS, FONTS } from "@/lib/pdf/fonts";
import { parseLayout, PLACEHOLDERS, type CertificateValues, type TemplateField, type TemplateLayout } from "@/lib/pdf/template";
import { orderForCertificates } from "@/lib/students/model";
import { certificateValues } from "@/lib/certificate/values";
import { useSession } from "@/state/session";
import { useTemplate } from "@/state/template";
import { FieldOverlay } from "./field-overlay";
import { NumberField } from "./number-field";

const FONT_OPTIONS = FONT_IDS.map((id) => ({ value: id, label: FONTS[id].label }));

type CalibrationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: CertificateValues | null;
};

export function CalibrationDialog({ open, onOpenChange, values }: CalibrationDialogProps) {
  const template = useTemplate();
  const { state } = useSession();
  const [draft, setDraft] = useState<TemplateLayout>(template.layout);
  const [selectedId, setSelectedId] = useState(template.layout.fields[0]?.id ?? "");
  const [sampleMode, setSampleMode] = useState<"first" | "longest">("longest");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const importRef = useRef<HTMLInputElement>(null);
  const page = template.pageSize ?? { width: 841.92, height: 595.32 };

  useEffect(() => {
    if (draft === template.layout) return;
    const timer = setTimeout(() => template.setLayout(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, template]);

  const sampleValues = useMemo(() => {
    const ordered = orderForCertificates(state.students);
    if (ordered.length === 0 || !values) return values;
    const student =
      sampleMode === "first" ? ordered[0] : ordered.reduce((longest, s) => (s.name.length > longest.name.length ? s : longest), ordered[0]);
    return { ...certificateValues(student, state.config), data: values.data, local: values.local };
  }, [sampleMode, state.students, state.config, values]);

  const previewValues = sampleValues ?? { nome: "Nome do Aluno de Exemplo", graduacao: "Azul-claro ponteira azul-escura", data: "28/06/2025", local: "Fortaleza/Ceará" };

  const padding = 48;
  const stageWidth = Math.max(0, Math.min(stage.width - padding, ((stage.height - padding) * page.width) / page.height));
  const scale = stageWidth / page.width;
  const selected = draft.fields.find((field) => field.id === selectedId) ?? null;

  const patchField = (id: string, patch: Partial<TemplateField>) =>
    setDraft((layout) => ({ fields: layout.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)) }));

  const addField = () => {
    const id = `campo-${Date.now().toString(36)}`;
    const field: TemplateField = {
      id,
      label: "Novo campo",
      text: "{local}",
      x: page.width * 0.3,
      y: page.height * 0.2,
      width: page.width * 0.4,
      align: "center",
      font: "tinos-bold-italic",
      size: 20,
      minSize: 10,
      color: "#000000",
      cover: null,
    };
    setDraft((layout) => ({ fields: [...layout.fields, field] }));
    setSelectedId(id);
  };

  const removeField = (id: string) => {
    setDraft((layout) => ({ fields: layout.fields.filter((field) => field.id !== id) }));
    setSelectedId(draft.fields.find((field) => field.id !== id)?.id ?? "");
  };

  const exportLayout = () => {
    const json = JSON.stringify({ app: "kruang", templateId: template.active.id, layout: draft }, null, 2);
    downloadBytes(`posicoes-${template.active.id}.json`, json, "application/json");
  };

  const importLayout = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { layout?: unknown };
      const layout = parseLayout(parsed.layout ?? parsed);
      if (!layout) throw new Error("invalid");
      setDraft(layout);
      setSelectedId(layout.fields[0]?.id ?? "");
      setMessage({ tone: "info", text: "Posições importadas." });
    } catch {
      setMessage({ tone: "error", text: "Este arquivo não contém uma configuração de posições válida." });
    }
  };

  const reset = () => {
    template.resetLayout();
    setDraft(template.defaultLayout);
    setSelectedId(template.defaultLayout.fields[0]?.id ?? "");
    setMessage({ tone: "info", text: "Posições originais restauradas." });
  };

  const close = (next: boolean) => {
    if (!next && draft !== template.layout) template.setLayout(draft);
    onOpenChange(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-950/85 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-hidden border-line-strong bg-ink-900 focus:outline-none data-[state=open]:animate-pop-in sm:inset-3 sm:rounded-2xl sm:border">
          <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-[19px] font-[720] tracking-[-0.02em] text-bone-50 [font-stretch:108%]">
                Ajustar posições do modelo
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-bone-500">
                Arraste os campos sobre o certificado. As mudanças são salvas neste navegador e valem para todos os certificados.
              </Dialog.Description>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={reset}>
                Restaurar padrão
              </Button>
              <Button variant="ghost" size="sm" icon={<Download className="size-3.5" />} onClick={exportLayout}>
                Exportar
              </Button>
              <Button variant="ghost" size="sm" icon={<Upload className="size-3.5" />} onClick={() => importRef.current?.click()}>
                Importar
              </Button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importLayout(file);
                }}
              />
              <Button variant="primary" size="sm" onClick={() => close(false)}>
                Concluir
              </Button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(280px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
            <div ref={stageRef} className="hairline-grid relative min-h-0 overflow-hidden bg-ink-950">
              {stageWidth > 0 && (
                <div
                  className="absolute"
                  style={{ width: stageWidth, left: (stage.width - stageWidth) / 2, top: Math.max(24, (stage.height - stageWidth * (page.height / page.width)) / 2) }}
                >
                  <LiveCertificate values={previewValues} layout={draft} width={stageWidth} label="Prévia da calibração" />
                  <div className="absolute inset-0" onPointerDown={() => setSelectedId("")}>
                    {draft.fields.map((field) => (
                      <FieldOverlay
                        key={field.id}
                        field={field}
                        scale={scale}
                        pageHeight={page.height}
                        selected={field.id === selectedId}
                        onSelect={() => setSelectedId(field.id)}
                        onChange={(patch) => patchField(field.id, patch)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="min-h-0 overflow-y-auto border-t border-line px-5 py-5 lg:border-l lg:border-t-0 sm:px-6">
              <div className="flex flex-col gap-2">
                <span id="calibracao-exemplo" className="text-[12px] text-bone-500">
                  Texto de exemplo
                </span>
                <Segmented
                  aria-labelledby="calibracao-exemplo"
                  value={sampleMode}
                  onValueChange={setSampleMode}
                  options={[
                    { value: "longest", label: "Nome mais longo" },
                    { value: "first", label: "Primeiro aluno" },
                  ]}
                />
              </div>

              <div className="mt-6 flex items-center justify-between">
                <h3 className="eyebrow">Campos</h3>
                <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={addField}>
                  Adicionar
                </Button>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {draft.fields.map((field) => (
                  <li key={field.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(field.id)}
                      aria-pressed={field.id === selectedId}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors",
                        field.id === selectedId ? "bg-ink-750 text-bone-50" : "text-bone-300 hover:bg-ink-850",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", field.id === selectedId ? "bg-signal-500" : "bg-bone-600")} />
                      <span className="min-w-0 flex-1 truncate">{field.label}</span>
                      <span className="max-w-[45%] truncate font-mono text-[11px] text-bone-500">{field.text}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {message && (
                <p
                  role={message.tone === "error" ? "alert" : "status"}
                  className={cn("mt-4 flex items-center justify-between gap-3 text-[13px]", message.tone === "error" ? "text-signal-300" : "text-bone-400")}
                >
                  {message.text}
                  <IconButton label="Fechar aviso" size="sm" onClick={() => setMessage(null)}>
                    <X className="size-3.5" />
                  </IconButton>
                </p>
              )}

              {selected ? (
                <FieldProperties
                  key={selected.id}
                  field={selected}
                  onChange={(patch) => patchField(selected.id, patch)}
                  onRemove={() => removeField(selected.id)}
                />
              ) : (
                <p className="mt-8 text-[13.5px] text-bone-500">Selecione um campo no certificado ou na lista para editar.</p>
              )}
            </aside>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FieldProperties({
  field,
  onChange,
  onRemove,
}: {
  field: TemplateField;
  onChange: (patch: Partial<TemplateField>) => void;
  onRemove: () => void;
}) {
  const textRef = useRef<HTMLInputElement>(null);

  const insertPlaceholder = (key: string) => {
    const input = textRef.current;
    const token = `{${key}}`;
    if (!input) return onChange({ text: field.text + token });
    const start = input.selectionStart ?? field.text.length;
    const end = input.selectionEnd ?? field.text.length;
    onChange({ text: field.text.slice(0, start) + token + field.text.slice(end) });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="mt-8 flex flex-col gap-6 border-t border-line pt-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="campo-nome" className="text-[12px] text-bone-500">
          Nome do campo
        </label>
        <input id="campo-nome" value={field.label} onChange={(e) => onChange({ label: e.target.value })} className={cn(inputClass, "h-9 text-[13.5px]")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="campo-texto" className="text-[12px] text-bone-500">
          Texto impresso
        </label>
        <input
          id="campo-texto"
          ref={textRef}
          value={field.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className={cn(inputClass, "h-9 font-mono text-[12.5px]")}
        />
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((placeholder) => (
            <button
              key={placeholder.key}
              type="button"
              onClick={() => insertPlaceholder(placeholder.key)}
              className="rounded-md border border-line-strong px-2 py-1 font-mono text-[11px] text-bone-300 hover:border-bone-500 hover:text-bone-50"
            >
              {`{${placeholder.key}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumberField label="X" value={field.x} onChange={(x) => onChange({ x })} />
        <NumberField label="Linha de base" value={field.y} onChange={(y) => onChange({ y })} />
        <NumberField label="Largura" value={field.width} min={1} onChange={(width) => onChange({ width })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="campo-alinhamento" className="text-[12px] text-bone-500">
          Alinhamento
        </span>
        <Segmented
          aria-labelledby="campo-alinhamento"
          value={field.align}
          onValueChange={(align) => onChange({ align })}
          options={[
            { value: "left", label: "Esquerda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Direita" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-bone-500">Fonte</span>
        <Select aria-label="Fonte" value={field.font} options={FONT_OPTIONS} onValueChange={(font) => onChange({ font: font as TemplateField["font"] })} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumberField label="Tamanho" value={field.size} min={1} onChange={(size) => onChange({ size, minSize: Math.min(field.minSize, size) })} />
        <NumberField label="Mínimo" value={field.minSize} min={1} onChange={(minSize) => onChange({ minSize: Math.min(minSize, field.size) })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-cor" className="text-[12px] text-bone-500">
            Cor
          </label>
          <input
            id="campo-cor"
            type="color"
            value={field.color}
            onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
            className="h-9 w-full cursor-pointer rounded-lg border border-line-strong bg-ink-950 p-1"
          />
        </div>
      </div>
      <p className="-mt-3 text-[12px] leading-relaxed text-bone-600">
        Textos longos diminuem automaticamente até o tamanho mínimo para caber na largura.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-bone-200">
          <input
            type="checkbox"
            checked={field.cover !== null}
            onChange={(e) =>
              onChange({
                cover: e.target.checked
                  ? { x: field.x - 4, y: field.y - field.size * 0.3, width: field.width + 8, height: field.size * 1.2, color: "#FFFFFF" }
                  : null,
              })
            }
            className="mt-0.5 size-4 accent-signal-500"
          />
          <span>
            Cobrir texto impresso no modelo
            <span className="mt-0.5 block text-[12px] text-bone-500">Pinta um retângulo antes do texto, para esconder dados fixos do PDF.</span>
          </span>
        </label>
        {field.cover && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="X" value={field.cover.x} onChange={(x) => field.cover && onChange({ cover: { ...field.cover, x } })} />
            <NumberField label="Y" value={field.cover.y} onChange={(y) => field.cover && onChange({ cover: { ...field.cover, y } })} />
            <NumberField label="Largura" value={field.cover.width} min={1} onChange={(width) => field.cover && onChange({ cover: { ...field.cover, width } })} />
            <NumberField label="Altura" value={field.cover.height} min={1} onChange={(height) => field.cover && onChange({ cover: { ...field.cover, height } })} />
          </div>
        )}
      </div>

      <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={onRemove} className="self-start">
        Remover campo
      </Button>
    </div>
  );
}
