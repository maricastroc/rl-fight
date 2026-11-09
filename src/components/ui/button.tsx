import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "signal" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-bone-50 text-ink-950 hover:bg-white shadow-[0_1px_0_rgb(255_255_255/0.4)_inset]",
  signal:
    "bg-signal-500 text-white hover:bg-signal-400 shadow-[0_1px_0_rgb(255_255_255/0.22)_inset,0_10px_30px_-12px_rgb(233_31_38/0.7)]",
  secondary: "border border-line-strong bg-ink-850 text-bone-100 hover:border-bone-600 hover:bg-ink-800",
  ghost: "text-bone-300 hover:bg-ink-850 hover:text-bone-50",
  danger: "border border-signal-500/40 bg-signal-900/40 text-signal-300 hover:bg-signal-900/70 hover:text-signal-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
  md: "h-10 gap-2 rounded-lg px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-xl px-5 text-[15px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, trailingIcon, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "group/button relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {trailingIcon && (
        <span className="transition-transform duration-200 ease-out group-hover/button:translate-x-0.5">{trailingIcon}</span>
      )}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }>(
  function IconButton({ label, size = "md", className, children, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg text-bone-400 transition-[background-color,color,transform] duration-150 hover:bg-ink-800 hover:text-bone-50 active:scale-95 disabled:pointer-events-none disabled:opacity-35",
          size === "sm" ? "size-8" : "size-10",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
