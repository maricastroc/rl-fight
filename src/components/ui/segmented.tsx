"use client";

import { motion } from "motion/react";
import { ToggleGroup } from "radix-ui";
import { useId } from "react";
import { cn } from "./cn";

type SegmentedProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

export function Segmented<T extends string>({ value, onValueChange, options, className, ...aria }: SegmentedProps<T>) {
  const indicatorId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as T)}
      className={cn("inline-flex flex-wrap gap-1 rounded-xl border border-line-strong bg-ink-900 p-1", className)}
      {...aria}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              "relative h-9 rounded-lg px-3.5 text-[13.5px] font-medium transition-colors duration-150",
              active ? "text-ink-950" : "text-bone-400 hover:text-bone-100",
            )}
          >
            {active && (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-0 rounded-lg bg-bone-50"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
