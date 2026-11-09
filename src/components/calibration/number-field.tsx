"use client";

import { useId, useState } from "react";

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
};

/** Numeric input that lets the user type freely and only commits valid numbers. */
export function NumberField({ label, value, onChange, step = 0.5, min, suffix = "pt" }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 100) / 100);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] text-bone-500">
        {label}
      </label>
      <div className="flex h-9 items-center rounded-lg border border-line-strong bg-ink-950 pr-2.5 transition-colors focus-within:border-bone-400 hover:border-bone-600">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={shown}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const parsed = Number(text.replace(",", "."));
            if (text.trim() !== "" && Number.isFinite(parsed) && (min === undefined || parsed >= min)) onChange(parsed);
          }}
          onBlur={() => setDraft(null)}
          className="h-full w-full min-w-0 bg-transparent px-2.5 font-mono text-[13px] tabular-nums text-bone-50 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="font-mono text-[11px] text-bone-600">{suffix}</span>
      </div>
    </div>
  );
}
