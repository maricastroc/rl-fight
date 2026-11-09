import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { SummaryCheck } from "@/lib/validation/validate";

/** Result of comparing the kruang order summary from the file with the student list. */
export function SummaryCheckView({ check, className }: { check: SummaryCheck; className?: string }) {
  if (check.matches) {
    return (
      <p className={cn("flex items-start gap-3 text-[14px] leading-relaxed text-bone-300", className)}>
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-bone-200" />
        <span>
          O resumo de kruangs confere: {check.total.expected} {check.total.expected === 1 ? "pedido" : "pedidos"} para{" "}
          {check.total.actual} {check.total.actual === 1 ? "aluno" : "alunos"}.
        </span>
      </p>
    );
  }

  const differences = check.rows.filter((row) => row.expected !== row.actual);
  return (
    <div className={cn("flex items-start gap-3 text-[14px] leading-relaxed", className)} role="status">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-amber-300">
          O resumo de kruangs não bate com a lista: {check.total.expected} pedidos, {check.total.actual} alunos.
        </p>
        {differences.length > 0 && (
          <table className="mt-3 w-full max-w-md text-[13px]">
            <thead>
              <tr className="text-left text-bone-500">
                <th className="py-1 font-normal">Graduação</th>
                <th className="py-1 text-right font-normal">Pedidos</th>
                <th className="py-1 text-right font-normal">Na lista</th>
              </tr>
            </thead>
            <tbody>
              {differences.map((row) => (
                <tr key={row.graduationId ?? row.label} className="border-t border-line text-bone-300">
                  <td className="py-1.5 pr-4">{row.label}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{row.expected}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-amber-300">{row.actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
