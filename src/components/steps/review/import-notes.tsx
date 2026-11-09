"use client";

import { Info, Plus, TriangleAlert, X } from "lucide-react";
import { useMemo } from "react";
import { SummaryCheckView } from "@/components/students/summary-check";
import { Button } from "@/components/ui/button";
import { getGraduation } from "@/lib/graduations/catalog";
import { createId } from "@/lib/students/model";
import { cleanPersonName } from "@/lib/text/normalize";
import { reconcileSummary } from "@/lib/validation/validate";
import { noteKey, useSession } from "@/state/session";

/** Things found during import that still deserve a look: unread lines, empty graduations, the kruang summary. */
export function ImportNotes() {
  const { state, dispatch } = useSession();
  const meta = state.importMeta;
  const fileSummary = meta?.summary ?? null;
  const summary = useMemo(
    () => (fileSummary ? reconcileSummary(fileSummary, state.students) : null),
    [fileSummary, state.students],
  );

  if (!meta) return null;
  const pending = meta.notes.filter((note) => note.kind === "unparsed" && !state.resolvedNotes.includes(noteKey(note)));
  const empty = meta.notes.filter((note) => note.kind === "empty-graduation");
  if (!summary && pending.length === 0 && empty.length === 0) return null;

  return (
    <section aria-label="Avisos da importação" className="flex flex-col gap-5 rounded-2xl border border-line bg-ink-900/60 px-5 py-5 sm:px-6">
      {summary && <SummaryCheckView check={summary} />}

      {empty.length > 0 && (
        <p className="flex items-start gap-3 text-[14px] leading-relaxed text-bone-400">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-bone-500" />
          <span>
            Sem alunos nesta turma:{" "}
            {empty.map((note) => (note.kind === "empty-graduation" && getGraduation(note.graduationId)?.label) || note.text).join(", ")}.
          </span>
        </p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-3 text-[14px] text-amber-300">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-400" />
            {pending.length === 1 ? "Uma linha do arquivo não foi entendida." : `${pending.length} linhas do arquivo não foram entendidas.`}{" "}
            Inclua como aluno ou ignore.
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {pending.map((note) => {
              if (note.kind !== "unparsed") return null;
              const graduation = getGraduation(note.graduationId);
              return (
                <li key={noteKey(note)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="font-mono text-[11px] text-bone-600">linha {note.row}</span>
                  <span className="min-w-0 flex-1 text-[14px] text-bone-100">“{note.text}”</span>
                  <span className="text-[12.5px] text-bone-500">{note.message}</span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="size-3.5" />}
                      onClick={() => {
                        dispatch({
                          type: "student/add",
                          student: {
                            id: createId(),
                            name: cleanPersonName(note.text),
                            graduation: graduation?.id ?? "",
                            sourceRow: note.row,
                          },
                        });
                        dispatch({ type: "note/resolve", key: noteKey(note) });
                      }}
                    >
                      Incluir{graduation ? ` em ${graduation.label}` : ""}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<X className="size-3.5" />}
                      onClick={() => dispatch({ type: "note/resolve", key: noteKey(note) })}
                    >
                      Ignorar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
