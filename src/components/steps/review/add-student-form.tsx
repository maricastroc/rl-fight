"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { graduationOptions } from "@/components/students/graduation-options";
import { Button, IconButton } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";
import { Select } from "@/components/ui/select";
import { cleanPersonName } from "@/lib/text/normalize";

const OPTIONS = graduationOptions();

export function AddStudentForm({
  defaultGraduation,
  onAdd,
  onClose,
}: {
  defaultGraduation: string;
  onAdd: (name: string, graduation: string) => void;
  onClose: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [graduation, setGraduation] = useState(defaultGraduation);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = cleanPersonName(nameRef.current?.value ?? "");
    if (!name) {
      setError("Digite o nome do aluno.");
      nameRef.current?.focus();
      return;
    }
    if (!graduation) {
      setError("Escolha a graduação.");
      return;
    }
    onAdd(name, graduation);
    setError(null);
    if (nameRef.current) nameRef.current.value = "";
    nameRef.current?.focus();
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Adicionar aluno"
      className="rounded-2xl border border-line-strong bg-ink-850 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[14px] font-medium text-bone-100">Adicionar aluno</p>
        <IconButton label="Fechar" size="sm" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px_auto]">
        <TextInput
          ref={nameRef}
          autoFocus
          aria-label="Nome completo do aluno"
          placeholder="Nome completo"
          autoComplete="off"
          spellCheck={false}
          onChange={() => error && setError(null)}
        />
        <Select aria-label="Graduação do novo aluno" value={graduation} placeholder="Graduação" options={OPTIONS} onValueChange={setGraduation} />
        <Button type="submit" variant="primary" className="h-11" icon={<Plus className="size-4" />}>
          Adicionar
        </Button>
      </div>
      <p role={error ? "alert" : undefined} className="mt-2.5 min-h-[18px] text-[13px] text-signal-300">
        {error ?? <span className="text-bone-500">Enter adiciona e mantém o formulário aberto para o próximo nome.</span>}
      </p>
    </form>
  );
}
