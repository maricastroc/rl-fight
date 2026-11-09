import { cn } from "@/components/ui/cn";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-[16px] w-[28px] overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(246_241_233/0.12)]">
          <span className="w-1/2 bg-bone-50" />
          <span className="w-1/2 bg-signal-500" />
        </span>
        <span
          className={cn(
            "font-display font-[820] leading-none tracking-[-0.035em] text-bone-50 [font-stretch:120%]",
            compact ? "text-[17px]" : "text-[20px]",
          )}
        >
          Kruang
        </span>
      </div>
      {!compact && <p className="mt-2.5 text-[12.5px] leading-snug text-bone-500">Certificados de graduação · Muay Thai</p>}
    </div>
  );
}
