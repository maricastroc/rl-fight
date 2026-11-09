import { GRADUATIONS, graduationOrder } from "../graduations/catalog";
import type { ParsedStudent } from "../import/types";

export type Student = {
  id: string;
  name: string;
  /** Catalogue id of the graduation, or "" while it is not defined. */
  graduation: string;
  sourceRow?: number;
  /** Graduation text as written in the imported file. */
  sourceGraduation?: string;
  /** Graduation was guessed from a misspelled or decorated heading. */
  inferred?: boolean;
  /** The teacher confirmed the record, silencing non-blocking warnings. */
  reviewed?: boolean;
};

let fallbackCounter = 0;

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  fallbackCounter += 1;
  return `s-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}

export function studentsFromImport(parsed: ParsedStudent[]): Student[] {
  return parsed.map((student) => ({
    id: createId(),
    name: student.name,
    graduation: student.graduationId ?? "",
    sourceRow: student.sourceRow,
    sourceGraduation: student.graduationText ?? undefined,
    inferred: student.inferred || undefined,
  }));
}

export type StudentGroup = { graduationId: string; students: Student[] };

/** Groups students by graduation in catalogue order; undefined graduations come first. */
export function groupByGraduation(students: Student[]): StudentGroup[] {
  const groups = new Map<string, Student[]>();
  for (const student of students) {
    const list = groups.get(student.graduation);
    if (list) list.push(student);
    else groups.set(student.graduation, [student]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "" || b === "") return a === "" ? -1 : 1;
      return graduationOrder(a) - graduationOrder(b);
    })
    .map(([graduationId, list]) => ({ graduationId, students: list }));
}

/** Students in certificate order: by graduation, then as they appear in the list. */
export function orderForCertificates(students: Student[]): Student[] {
  return groupByGraduation(students).flatMap((group) => group.students);
}

export function countByGraduation(students: Student[]): Map<string, number> {
  const counts = new Map<string, number>(GRADUATIONS.map((g) => [g.id, 0]));
  for (const student of students) counts.set(student.graduation, (counts.get(student.graduation) ?? 0) + 1);
  return counts;
}
