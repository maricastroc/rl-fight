import { describe, expect, it } from "vitest";
import {
  configProblems,
  DEFAULT_CERTIFICATE_CONFIG,
  formatExamDate,
  formatLocation,
  parseIsoDate,
  weekdayOf,
} from "@/lib/certificate/config";
import { certificateValues } from "@/lib/certificate/values";

describe("exam date", () => {
  it("formats in Brazilian Portuguese", () => {
    expect(formatExamDate("2025-06-28", "numeric")).toBe("28/06/2025");
    expect(formatExamDate("2025-06-28", "long")).toBe("28 de junho de 2025");
    expect(formatExamDate("2026-03-01", "long")).toBe("1º de março de 2026");
    expect(weekdayOf("2025-06-28")).toBe("sábado");
  });

  it("rejects impossible dates", () => {
    expect(parseIsoDate("2025-02-30")).toBeNull();
    expect(formatExamDate("", "numeric")).toBe("");
  });
});

describe("location", () => {
  it("prints city and state as on the original certificate", () => {
    expect(formatLocation("Fortaleza", "CE")).toBe("Fortaleza/Ceará");
    expect(formatLocation("  São Gonçalo   do Amarante ", "RN")).toBe("São Gonçalo do Amarante/Rio Grande do Norte");
    expect(formatLocation("Sobral", "")).toBe("Sobral");
  });
});

describe("certificate values", () => {
  it("combines student and exam data", () => {
    const config = { ...DEFAULT_CERTIFICATE_CONFIG, examDate: "2025-06-28" };
    expect(certificateValues({ name: "MARIA DA SILVA", graduation: "azul-claro" }, config)).toEqual({
      nome: "Maria da Silva",
      graduacao: "Azul-claro",
      data: "28/06/2025",
      local: "Fortaleza/Ceará",
    });
  });

  it("reports missing configuration", () => {
    expect(configProblems({ ...DEFAULT_CERTIFICATE_CONFIG, city: " " })).toEqual({
      examDate: "Informe a data do exame",
      city: "Informe a cidade",
    });
  });
});
