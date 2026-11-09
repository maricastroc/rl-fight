import { getGraduation, KRUANG_HEX } from "@/lib/graduations/catalog";
import { cn } from "./cn";

const SIZES = {
  xs: "h-2.5 w-[18px]",
  sm: "h-3 w-[22px]",
  md: "h-4 w-[30px]",
  lg: "h-6 w-[44px]",
};

/** Two-tone swatch mirroring the kruang squares printed on the certificate: body colour, then tip colour. */
export function KruangChip({ graduationId, size = "sm", className }: { graduationId: string; size?: keyof typeof SIZES; className?: string }) {
  const graduation = getGraduation(graduationId);
  if (!graduation) {
    return (
      <span
        aria-hidden
        className={cn("inline-block shrink-0 rounded-[2px] border border-dashed border-bone-600", SIZES[size], className)}
      />
    );
  }
  const body = KRUANG_HEX[graduation.body];
  const tip = KRUANG_HEX[graduation.tip ?? graduation.body];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(246_241_233/0.16)]", SIZES[size], className)}
    >
      <span className="h-full w-1/2" style={{ backgroundColor: body }} />
      <span className="h-full w-1/2" style={{ backgroundColor: tip }} />
    </span>
  );
}
