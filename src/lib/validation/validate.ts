import { getGraduation } from "../graduations/catalog";
import type { KruangSummary } from "../import/types";
import type { Student } from "../students/model";
import { editDistance } from "../text/distance";
import { foldKey } from "../text/normalize";

export type IssueCode =
  | "name-empty"
  | "graduation-missing"
  | "graduation-inferred"
  | "duplicate"
  | "similar-name"
  | "single-word-name"
  | "unusual-characters";

export type StudentIssue = {
  code: IssueCode;
  severity: "error" | "warning";
  message: string;
  relatedIds?: string[];
};

const NAME_CHARACTERS = /^[\p{L}\p{M}'’ʼ`.\- ]*$/u;

function sortedTokens(key: string): string {
  return key.split(" ").sort().join(" ");
}

function nameIssues(student: Student): StudentIssue[] {
  const name = student.name.trim();
  if (!name) return [{ code: "name-empty", severity: "error", message: "Nome em branco" }];

  const issues: StudentIssue[] = [];
  if (!NAME_CHARACTERS.test(name)) {
    issues.push({ code: "unusual-characters", severity: "warning", message: "O nome contém números ou símbolos" });
  }
  if (name.split(/\s+/).length === 1) {
    issues.push({ code: "single-word-name", severity: "warning", message: "Só um nome — confira se está completo" });
  }
  return issues;
}

function graduationIssues(student: Student): StudentIssue[] {
  const graduation = getGraduation(student.graduation);
  if (!graduation) {
    const origin = student.sourceGraduation ? ` (no arquivo: “${student.sourceGraduation}”)` : "";
    return [{ code: "graduation-missing", severity: "error", message: `Escolha a graduação${origin}` }];
  }
  if (student.inferred) {
    return [
      {
        code: "graduation-inferred",
        severity: "warning",
        message: `Graduação deduzida de “${student.sourceGraduation ?? "?"}” — confirme se é ${graduation.label}`,
      },
    ];
  }
  return [];
}

function similarityIssues(students: Student[]): Map<string, StudentIssue[]> {
  const result = new Map<string, StudentIssue[]>();
  const keyed = students
    .map((student) => ({ student, key: foldKey(student.name) }))
    .filter((entry) => entry.key.length > 0);

  const add = (id: string, issue: StudentIssue) => {
    const list = result.get(id) ?? [];
    const existing = list.find((i) => i.code === issue.code);
    if (existing) existing.relatedIds = [...new Set([...(existing.relatedIds ?? []), ...(issue.relatedIds ?? [])])];
    else list.push(issue);
    result.set(id, list);
  };

  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      const a = keyed[i];
      const b = keyed[j];
      if (a.key === b.key) {
        add(a.student.id, { code: "duplicate", severity: "warning", message: "Nome repetido na lista", relatedIds: [b.student.id] });
        add(b.student.id, { code: "duplicate", severity: "warning", message: "Nome repetido na lista", relatedIds: [a.student.id] });
        continue;
      }
      const similar =
        sortedTokens(a.key) === sortedTokens(b.key) ||
        (Math.min(a.key.length, b.key.length) >= 8 && editDistance(a.key, b.key, 1) <= 1);
      if (similar) {
        add(a.student.id, { code: "similar-name", severity: "warning", message: `Muito parecido com “${b.student.name}”`, relatedIds: [b.student.id] });
        add(b.student.id, { code: "similar-name", severity: "warning", message: `Muito parecido com “${a.student.name}”`, relatedIds: [a.student.id] });
      }
    }
  }
  return result;
}

/** Returns the issues of each student; errors block generation, warnings only ask for a look. */
export function validateStudents(students: Student[]): Map<string, StudentIssue[]> {
  const similarity = similarityIssues(students);
  const result = new Map<string, StudentIssue[]>();
  for (const student of students) {
    let issues = [...nameIssues(student), ...graduationIssues(student), ...(similarity.get(student.id) ?? [])];
    if (student.reviewed) issues = issues.filter((issue) => issue.severity === "error");
    if (issues.length > 0) result.set(student.id, issues);
  }
  return result;
}

export function countIssues(issues: Map<string, StudentIssue[]>): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const list of issues.values()) {
    if (list.some((i) => i.severity === "error")) errors += 1;
    else if (list.length > 0) warnings += 1;
  }
  return { errors, warnings };
}

export type SummaryCheckRow = { graduationId: string | null; label: string; expected: number; actual: number };

export type SummaryCheck = {
  rows: SummaryCheckRow[];
  total: { expected: number; actual: number };
  matches: boolean;
};

/** Compares the kruang order summary found in the file with the students currently in the list. */
export function reconcileSummary(summary: KruangSummary, students: Student[]): SummaryCheck {
  const expected = new Map<string, { label: string; quantity: number; graduationId: string | null }>();
  for (const entry of summary.entries) {
    const key = entry.graduationId ?? `?${entry.text}`;
    const current = expected.get(key);
    expected.set(key, {
      label: getGraduation(entry.graduationId)?.label ?? entry.text,
      quantity: (current?.quantity ?? 0) + entry.quantity,
      graduationId: entry.graduationId,
    });
  }

  const actual = new Map<string, number>();
  for (const student of students) actual.set(student.graduation, (actual.get(student.graduation) ?? 0) + 1);

  const rows: SummaryCheckRow[] = [...expected.entries()].map(([key, value]) => ({
    graduationId: value.graduationId,
    label: value.label,
    expected: value.quantity,
    actual: value.graduationId ? (actual.get(key) ?? 0) : 0,
  }));
  if (summary.entries.length > 0) {
    for (const [graduationId, count] of actual) {
      if (graduationId && !expected.has(graduationId)) {
        rows.push({ graduationId, label: getGraduation(graduationId)?.label ?? graduationId, expected: 0, actual: count });
      }
    }
  }

  const expectedTotal = summary.total?.quantity ?? rows.reduce((sum, row) => sum + row.expected, 0);
  const total = { expected: expectedTotal, actual: students.length };
  const matches = total.expected === total.actual && rows.every((row) => row.expected === row.actual);
  return { rows, total, matches };
}
