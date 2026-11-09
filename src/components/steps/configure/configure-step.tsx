"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { StepFooter, StepHeader } from "@/components/app/step-layout";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { BRAZILIAN_STATES, formatExamDate, formatLocation, weekdayOf } from "@/lib/certificate/config";
import { certificateValues } from "@/lib/certificate/values";
import { orderForCertificates } from "@/lib/students/model";
import { applyNameCase, type NameCase } from "@/lib/text/name-case";
import { useSession, useSessionInsights } from "@/state/session";
import { TemplatePanel } from "./template-panel";

const STATE_OPTIONS = [
  { value: "none", label: "Não incluir o estado" },
  ...BRAZILIAN_STATES.map(([code, name]) => ({ value: code, label: name, detail: code })),
];

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-line py-8 first:border-t-0 first:pt-0 2xl:grid-cols-[160px_minmax(0,1fr)] 2xl:gap-10">
      <h2 className="flex items-baseline gap-3 2xl:flex-col 2xl:gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-bone-600">{number}</span>
        <span className="font-display text-[17px] font-[680] tracking-[-0.015em] text-bone-50 font-stretch-106%">{title}</span>
      </h2>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

export function ConfigureStep() {
  const { state, dispatch } = useSession();
  const insights = useSessionInsights();
  const { config } = state;
  const [showErrors, setShowErrors] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<typeof config>) => dispatch({ type: "config", patch });
  const sample = useMemo(() => orderForCertificates(state.students)[0] ?? null, [state.students]);
  const sampleValues = useMemo(() => {
    if (!sample) return null;
    const values = certificateValues(sample, config);
    return { ...values, data: values.data || "__/__/____" };
  }, [sample, config]);

  const longDate = formatExamDate(config.examDate, "long");
  const dateErrors = showErrors ? insights.configErrors : {};
  const dateExample = config.examDate || "2025-06-28";

  const proceed = () => {
    if (insights.canGenerate) {
      dispatch({ type: "step", step: "generate" });
      return;
    }
    setShowErrors(true);
    if (insights.configErrors.examDate) dateRef.current?.focus();
    else if (insights.configErrors.city) cityRef.current?.focus();
  };

  const nameSample = sample?.name ?? "Helena Duarte da Silva";

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        number="03"
        title={
          <>
            Dados do <em>exame</em>.
          </>
        }
        lede="Estas informações são iguais em todos os certificados. A prévia ao lado é o próprio PDF, atualizado enquanto você preenche."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(380px,500px)] xl:gap-14">
        <div>
          <Section number="01" title="Data do exame">
            <Field
              label="Data em que o exame foi/será realizado"
              error={dateErrors.examDate}
              hint={longDate ? `${weekdayOf(config.examDate)}, ${longDate}` : "Use o calendário ou digite a data."}
            >
              {(props) => (
                <TextInput
                  {...props}
                  ref={dateRef}
                  type="date"
                  value={config.examDate}
                  max="2100-12-31"
                  onChange={(event) => update({ examDate: event.target.value })}
                  className="max-w-65 scheme-dark"
                />
              )}
            </Field>
            <div className="flex flex-col gap-2">
              <span id="formato-data" className="text-[13px] font-medium text-bone-300">
                Como a data aparece
              </span>
              <Segmented
                aria-labelledby="formato-data"
                value={config.dateStyle}
                onValueChange={(dateStyle) => update({ dateStyle })}
                options={[
                  { value: "numeric", label: formatExamDate(dateExample, "numeric") },
                  { value: "long", label: formatExamDate(dateExample, "long") },
                ]}
              />
            </div>
          </Section>

          <Section number="02" title="Local">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Cidade" error={dateErrors.city}>
                {(props) => (
                  <TextInput
                    {...props}
                    ref={cityRef}
                    value={config.city}
                    autoComplete="address-level2"
                    placeholder="Ex.: Fortaleza"
                    onChange={(event) => update({ city: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Estado">
                {(props) => (
                  <Select
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    value={config.state || "none"}
                    options={STATE_OPTIONS}
                    onValueChange={(value) => update({ state: value === "none" ? "" : value })}
                  />
                )}
              </Field>
            </div>
            <p className="text-[13px] text-bone-500">
              No certificado: <span className="text-bone-200">{formatLocation(config.city, config.state) || "—"}</span>
            </p>
          </Section>

          <Section number="03" title="Nome do aluno">
            <div className="flex flex-col gap-2">
              <span id="formato-nome" className="text-[13px] font-medium text-bone-300">
                Como os nomes aparecem
              </span>
              <Segmented<NameCase>
                aria-labelledby="formato-nome"
                value={config.nameCase}
                onValueChange={(nameCase) => update({ nameCase })}
                options={[
                  { value: "title", label: "Iniciais maiúsculas" },
                  { value: "upper", label: "MAIÚSCULAS" },
                  { value: "original", label: "Como na lista" },
                ]}
              />
            </div>
            <p className="text-[13px] text-bone-500">
              Exemplo: <span className="text-bone-200">{applyNameCase(nameSample, config.nameCase)}</span>
            </p>
          </Section>
        </div>

        <TemplatePanel values={sampleValues} sampleName={sample?.name ?? null} />
      </div>

      <StepFooter>
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => dispatch({ type: "step", step: "review" })}>
          Conferir
        </Button>
        <Button variant="primary" size="lg" onClick={proceed} trailingIcon={<ArrowRight className="size-4" />}>
          Ver certificados
        </Button>
      </StepFooter>
    </div>
  );
}
