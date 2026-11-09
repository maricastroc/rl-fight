import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export const inputClass =
  "h-11 w-full rounded-lg border border-line-strong bg-ink-900 px-3.5 text-[15px] text-bone-50 placeholder:text-bone-600 transition-[border-color,background-color,box-shadow] duration-150 hover:border-bone-600 focus:border-bone-400 focus:bg-ink-850 focus:outline-none focus:ring-4 focus:ring-bone-50/5 aria-[invalid=true]:border-signal-500/70";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
};

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-bone-300">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-signal-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-bone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
