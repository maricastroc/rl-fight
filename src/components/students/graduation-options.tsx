import { KruangChip } from "@/components/ui/kruang-chip";
import type { SelectOption } from "@/components/ui/select";
import { GRADUATIONS } from "@/lib/graduations/catalog";

export function graduationOptions(counts?: Map<string, number>): SelectOption[] {
  return GRADUATIONS.map((graduation) => ({
    value: graduation.id,
    label: graduation.label,
    icon: <KruangChip graduationId={graduation.id} />,
    detail: counts ? String(counts.get(graduation.id) ?? 0) : undefined,
  }));
}
