"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type StepHeaderProps = {
  number: string;
  title: ReactNode;
  lede: ReactNode;
  aside?: ReactNode;
};

/** Step title block; focus moves to the heading when the step opens so screen readers announce it. */
export function StepHeader({ number, title, lede, aside }: StepHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <header className="mb-10 flex flex-col gap-8 lg:mb-14 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-[760px]">
        <p className="eyebrow">Etapa {number} — de 04</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-[clamp(2.6rem,6vw,4.6rem)] outline-none"
        >
          {title}
        </h1>
        <p className="mt-6 max-w-[56ch] text-[16px] leading-[1.6] text-bone-400 sm:text-[17px]">{lede}</p>
      </div>
      {aside}
    </header>
  );
}

export function StepFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-12 border-t border-line bg-ink-950/88 px-4 py-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}
