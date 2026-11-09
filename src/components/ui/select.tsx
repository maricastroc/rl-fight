"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type SelectOption = { value: string; label: string; icon?: ReactNode; detail?: ReactNode };

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  size?: "sm" | "md";
  className?: string;
  triggerClassName?: string;
};

export function Select({ value, onValueChange, options, placeholder, size = "md", className, triggerClassName, ...aria }: SelectProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <RadixSelect.Root value={value || undefined} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        {...aria}
        className={cn(
          "group inline-flex w-full items-center justify-between gap-2 rounded-lg border text-left transition-[border-color,background-color] duration-150 focus:outline-none focus-visible:border-bone-400 data-[placeholder]:text-bone-500 aria-[invalid=true]:border-signal-500/70",
          size === "sm"
            ? "h-9 border-transparent bg-transparent px-2.5 text-[13.5px] text-bone-200 hover:border-line-strong hover:bg-ink-850 data-[state=open]:border-line-strong data-[state=open]:bg-ink-850"
            : "h-11 border-line-strong bg-ink-900 px-3.5 text-[15px] text-bone-50 hover:border-bone-600 data-[state=open]:border-bone-400",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected?.icon}
          <span className="truncate">
            <RadixSelect.Value placeholder={placeholder}>{selected?.label}</RadixSelect.Value>
          </span>
        </span>
        <RadixSelect.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-bone-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            "z-50 max-h-[min(420px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line-strong bg-ink-850/98 p-1 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur-sm data-[state=open]:animate-pop-in",
            className,
          )}
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-9 text-[13.5px] text-bone-200 outline-none data-[highlighted]:bg-ink-700 data-[highlighted]:text-bone-50 data-[state=checked]:text-bone-50"
              >
                {option.icon}
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                {option.detail && <span className="ml-auto pl-3 font-mono text-[11px] text-bone-500">{option.detail}</span>}
                <RadixSelect.ItemIndicator className="absolute right-2.5">
                  <Check className="size-3.5 text-signal-400" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
