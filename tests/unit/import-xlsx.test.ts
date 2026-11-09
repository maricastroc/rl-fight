import { describe, expect, it } from "vitest";
import { interpretSource, readSource } from "@/lib/import/import-file";
import { buildXlsx, fileFrom, type XlsxSheet } from "../helpers/ooxml";

async function source(sheets: XlsxSheet[]) {
  return readSource(fileFrom("lista.xlsx", await buildXlsx(sheets)));
}

describe("XLSX import — table layout", () => {
  const sheet: XlsxSheet = {
    name: "Planilha1",
    rows: [
      ["LISTA GRADUAÇÃO FIGHT & FIT DOJO"],
      [],
      ["ALUNO(A)", "GRADUAÇÃO ATUAL", "GRADUAÇÃO PRETENDIDA"],
      [],
      ["Vânia Prates Lobo", "Branco", "Branco ponteira vermelha "],
      ["Levi Andrade", "Branco ponteira vermelha", "Vermelho"],
      ["Saulo Péres Dantas", "Azul claro ponteira azul escura (não recebeu)", "Azul escuro"],
      ["Sofia Prado", "Vermelha", ""],
    ],
  };

  it("finds the header, prefers the intended graduation over the current one and keeps row numbers", async () => {
    const { interpretation } = interpretSource(await source([sheet]));
    expect(interpretation.structure).toBe("tabular");
    expect(interpretation.tabular).toMatchObject({ headerRow: 3, nameColumn: 0, graduationColumn: 2 });
    expect(interpretation.students.map((s) => [s.name, s.graduationId, s.sourceRow])).toEqual([
      ["Vânia Prates Lobo", "branca-ponteira-vermelha", 5],
      ["Levi Andrade", "vermelha", 6],
      ["Saulo Péres Dantas", "azul-escura", 7],
      ["Sofia Prado", null, 8],
    ]);
    expect(interpretation.notes).toContainEqual(expect.objectContaining({ kind: "ignored", row: 1 }));
  });

  it("lets the teacher choose another column", async () => {
    const { interpretation } = interpretSource(await source([sheet]), 0, { columns: { nameColumn: 0, graduationColumn: 1 } });
    expect(interpretation.students[1]).toMatchObject({ name: "Levi Andrade", graduationId: "branca-ponteira-vermelha" });
  });

  it("detects a table without a header row", async () => {
    const { interpretation } = interpretSource(
      await source([
        {
          name: "Sem cabeçalho",
          rows: [
            ["Ana Clara Mota", "Roxa"],
            ["Bruno Teles", "Marrom"],
            ["Cecília Andrade", "Preta"],
          ],
        },
      ]),
    );
    expect(interpretation.structure).toBe("tabular");
    expect(interpretation.tabular?.headerRow).toBeNull();
    expect(interpretation.students.map((s) => s.graduationId)).toEqual(["roxa", "marrom", "preta"]);
  });
});

describe("XLSX import — grouped layout", () => {
  const grouped: XlsxSheet = {
    name: "Plan1",
    rows: [
      [],
      [null, "LISTA GRADUAÇÃO 2023.2"],
      [null, "BRANCA PONTEIRA VERMELHA"],
      [1, "1.       ALINE PEIXOTO SAMPAIO "],
      [2, "2.      TOMÁS LUCAS DE ARAGÃO"],
      [null, "VERMELHA "],
      [3, "1.         HÉLIO D’ÁVILA MACEDO"],
      [null, "GRAL PRETO "],
      [4, "1.     JORGE TAVARES"],
      [],
      [null, "LISTA PEDIDO DE KRUANGS "],
      [null, "(02 UNIDADES) ", "BRANCA PONTEIRA VERMELHA"],
      [null, "(01 UNIDADE) ", "VERMELHA "],
      [null, "(01 UNIDADE) PRETA "],
      [null, "TOTAL KRUANGS 4 KRUANGS"],
    ],
  };

  it("ignores the index column, strips per-group numbering and reads the split summary", async () => {
    const { interpretation } = interpretSource(await source([grouped]));
    expect(interpretation.structure).toBe("grouped");
    expect(interpretation.students.map((s) => [s.name, s.graduationId])).toEqual([
      ["ALINE PEIXOTO SAMPAIO", "branca-ponteira-vermelha"],
      ["TOMÁS LUCAS DE ARAGÃO", "branca-ponteira-vermelha"],
      ["HÉLIO D’ÁVILA MACEDO", "vermelha"],
      ["JORGE TAVARES", "preta"],
    ]);
    expect(interpretation.summary?.entries.map((e) => [e.graduationId, e.quantity])).toEqual([
      ["branca-ponteira-vermelha", 2],
      ["vermelha", 1],
      ["preta", 1],
    ]);
    expect(interpretation.summary?.total?.quantity).toBe(4);
  });

  it("marks students under a misspelled heading as inferred", async () => {
    const { interpretation } = interpretSource(await source([grouped]));
    expect(interpretation.students.at(-1)).toMatchObject({ graduationId: "preta", inferred: true, graduationText: "GRAL PRETO" });
    expect(interpretation.notes).toContainEqual(expect.objectContaining({ kind: "inferred-graduation", text: "GRAL PRETO" }));
  });
});

describe("XLSX import — multiple sheets", () => {
  it("selects the sheet with the most students and allows switching", async () => {
    const extracted = await source([
      { name: "Instruções", rows: [["Preencha a aba Turma"]] },
      { name: "Turma", rows: [["Nome", "Graduação"], ["Ana", "Roxa"], ["Rui Paz", "Preta"]] },
      { name: "Reserva", rows: [["VERMELHA"], ["1. Tito Ramos"]] },
    ]);
    const automatic = interpretSource(extracted);
    expect(automatic.sheetIndex).toBe(1);
    expect(automatic.sheets.map((s) => [s.name, s.studentCount])).toEqual([
      ["Instruções", 0],
      ["Turma", 2],
      ["Reserva", 1],
    ]);
    const chosen = interpretSource(extracted, 2);
    expect(chosen.interpretation.students.map((s) => s.name)).toEqual(["Tito Ramos"]);
  });
});
