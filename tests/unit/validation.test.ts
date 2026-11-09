import { describe, expect, it } from "vitest";
import type { Student } from "@/lib/students/model";
import { groupByGraduation, orderForCertificates } from "@/lib/students/model";
import { countIssues, reconcileSummary, validateStudents } from "@/lib/validation/validate";

let counter = 0;
const student = (name: string, graduation = "vermelha", extra: Partial<Student> = {}): Student => ({
  id: `s${++counter}`,
  name,
  graduation,
  ...extra,
});

const codes = (issues: ReturnType<typeof validateStudents>, s: Student) => (issues.get(s.id) ?? []).map((i) => i.code);

describe("validateStudents", () => {
  it("blocks empty names and missing graduations", () => {
    const empty = student("  ");
    const noGraduation = student("Ana Lima", "", { sourceGraduation: "AZUL" });
    const issues = validateStudents([empty, noGraduation]);
    expect(codes(issues, empty)).toEqual(["name-empty"]);
    expect(issues.get(noGraduation.id)?.[0]).toMatchObject({ code: "graduation-missing", severity: "error" });
    expect(issues.get(noGraduation.id)?.[0].message).toContain("AZUL");
    expect(countIssues(issues)).toEqual({ errors: 2, warnings: 0 });
  });

  it("finds duplicates ignoring case, accents and punctuation", () => {
    const a = student("Hélio D’Ávila");
    const b = student("HELIO D'AVILA", "roxa");
    const issues = validateStudents([a, b]);
    expect(codes(issues, a)).toContain("duplicate");
    expect(issues.get(b.id)?.find((i) => i.code === "duplicate")?.relatedIds).toEqual([a.id]);
  });

  it("flags names that differ by one letter or by word order", () => {
    const a = student("Renata Campos Lima");
    const b = student("Renata Campos Lim");
    const c = student("Silva Joana");
    const d = student("Joana Silva");
    const issues = validateStudents([a, b, c, d]);
    expect(codes(issues, a)).toContain("similar-name");
    expect(codes(issues, c)).toContain("similar-name");
  });

  it("does not confuse different people with similar surnames", () => {
    const issues = validateStudents([student("Brenda Moraes Leite"), student("Bruna Moraes Leite")]);
    expect(issues.size).toBe(0);
  });

  it("warns about single names, unusual characters and inferred graduations", () => {
    const single = student("Lúcio");
    const digits = student("Ana 2 Silva");
    const inferred = student("Jorge Tavares", "preta", { inferred: true, sourceGraduation: "GRAL PRETO" });
    const issues = validateStudents([single, digits, inferred]);
    expect(codes(issues, single)).toEqual(["single-word-name"]);
    expect(codes(issues, digits)).toEqual(["unusual-characters"]);
    expect(codes(issues, inferred)).toEqual(["graduation-inferred"]);
  });

  it("lets the teacher confirm warnings but never errors", () => {
    const confirmed = student("Lúcio", "preta", { reviewed: true });
    const blocked = student("", "preta", { reviewed: true });
    const issues = validateStudents([confirmed, blocked]);
    expect(issues.has(confirmed.id)).toBe(false);
    expect(codes(issues, blocked)).toEqual(["name-empty"]);
  });
});

describe("summary reconciliation", () => {
  it("compares totals per graduation, including graduations missing from the summary", () => {
    const students = [student("Ana Paz", "vermelha"), student("Rui Paz", "vermelha"), student("Lia Paz", "roxa")];
    const check = reconcileSummary(
      { entries: [{ graduationId: "vermelha", text: "VERMELHA", quantity: 2, row: 10 }], total: { quantity: 2, row: 12 } },
      students,
    );
    expect(check.matches).toBe(false);
    expect(check.total).toEqual({ expected: 2, actual: 3 });
    expect(check.rows).toContainEqual({ graduationId: "roxa", label: "Roxa", expected: 0, actual: 1 });
  });
});

describe("ordering", () => {
  it("groups by catalogue order with undefined graduations first", () => {
    const list = [student("C", "preta"), student("A", "branca-ponteira-vermelha"), student("X", ""), student("B", "preta")];
    expect(groupByGraduation(list).map((g) => g.graduationId)).toEqual(["", "branca-ponteira-vermelha", "preta"]);
    expect(orderForCertificates(list).map((s) => s.name)).toEqual(["X", "A", "C", "B"]);
  });
});
