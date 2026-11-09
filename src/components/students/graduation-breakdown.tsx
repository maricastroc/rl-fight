"use client";

import { motion } from "motion/react";
import { cn } from "@/components/ui/cn";
import { KruangChip } from "@/components/ui/kruang-chip";
import { getGraduation, GRADUATIONS, KRUANG_HEX } from "@/lib/graduations/catalog";

export type GraduationCount = { graduationId: string; count: number };

/** Counts in catalogue order, including graduations without students when `includeEmpty` is set. */
export function countsInOrder(counts: Map<string, number>, includeEmpty: string[] = []): GraduationCount[] {
  const known = GRADUATIONS.filter((g) => (counts.get(g.id) ?? 0) > 0 || includeEmpty.includes(g.id)).map((g) => ({
    graduationId: g.id,
    count: counts.get(g.id) ?? 0,
  }));
  const unknown = counts.get("") ?? 0;
  return unknown > 0 ? [{ graduationId: "", count: unknown }, ...known] : known;
}

/** Proportional strip of the class, painted with each kruang's colours. */
export function DistributionBar({
  counts,
  active,
  onSelect,
  className,
}: {
  counts: GraduationCount[];
  active?: string | null;
  onSelect?: (graduationId: string) => void;
  className?: string;
}) {
  const filled = counts.filter((c) => c.count > 0);
  if (filled.length === 0) return null;
  const describe = (c: GraduationCount) => `${getGraduation(c.graduationId)?.label ?? "Sem graduação"}: ${c.count}`;

  return (
    <div
      className={cn("flex h-3 w-full gap-[3px]", className)}
      role={onSelect ? "group" : "img"}
      aria-label={onSelect ? "Filtrar por graduação" : `Distribuição por graduação — ${filled.map(describe).join(", ")}`}
    >
      {filled.map((c, index) => {
        const graduation = getGraduation(c.graduationId);
        const body = graduation ? KRUANG_HEX[graduation.body] : "transparent";
        const tip = graduation ? KRUANG_HEX[graduation.tip ?? graduation.body] : "transparent";
        const dimmed = active !== undefined && active !== null && active !== c.graduationId;
        const shared = {
          initial: { scaleX: 0, opacity: 0 },
          animate: { scaleX: 1, opacity: dimmed ? 0.28 : 1 },
          transition: { delay: index * 0.035, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
          title: describe(c),
          className: cn(
            "relative h-full origin-left overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(246_241_233/0.14)]",
            !graduation && "border border-dashed border-signal-400",
            onSelect && "cursor-pointer transition-transform hover:-translate-y-0.5",
          ),
          style: {
            flexGrow: c.count,
            flexBasis: 0,
            minWidth: 6,
            background: `linear-gradient(to right, ${body} 0 70%, ${tip} 70% 100%)`,
          },
        };
        return onSelect ? (
          <motion.button
            key={c.graduationId || "unknown"}
            type="button"
            aria-label={describe(c)}
            aria-pressed={active === c.graduationId}
            onClick={() => onSelect(c.graduationId)}
            {...shared}
          />
        ) : (
          <motion.span key={c.graduationId || "unknown"} aria-hidden {...shared} />
        );
      })}
    </div>
  );
}

export function GraduationList({ counts, className }: { counts: GraduationCount[]; className?: string }) {
  return (
    <ul className={cn("grid gap-x-10 sm:grid-cols-2", className)}>
      {counts.map((c) => {
        const graduation = getGraduation(c.graduationId);
        return (
          <li
            key={c.graduationId || "unknown"}
            className={cn("flex items-center gap-3 border-b border-line py-2.5 text-[14px]", c.count === 0 && "opacity-45")}
          >
            <KruangChip graduationId={c.graduationId} />
            <span className={cn("min-w-0 flex-1 truncate", graduation ? "text-bone-200" : "text-signal-300")}>
              {graduation?.label ?? "Sem graduação definida"}
            </span>
            <span className="font-mono text-[12.5px] tabular-nums text-bone-400">
              {c.count === 0 ? "nenhum" : c.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
