import { describe, expect, it } from "vitest";
import { interpretSource, readSource } from "@/lib/import/import-file";
import { reconcileSummary } from "@/lib/validation/validate";
import { studentsFromImport } from "@/lib/students/model";
import { buildDocx, fileFrom, type DocxBlock } from "../helpers/ooxml";

const list = (text: string): DocxBlock => ({ text, list: true });

async function importDocx(blocks: DocxBlock[], options?: { header?: string }) {
  const source = await readSource(fileFrom("lista.docx", await buildDocx(blocks, options)));
  return interpretSource(source).interpretation;
}

describe("DOCX import — graduation headings followed by Word numbered lists", () => {
  const blocks: DocxBlock[] = [
    "",
    "LISTA GRADUAÇÃO 2026.2",
    "",
    "BRANCA PONTEIRA VERMELHA",
    "",
    list("CAIO DOS REIS VALENTE MOURA DA LUZ"),
    list("DÉBORA RAMALHO TEIXEIRA"),
    list("ÍTALO QUEIROZ"),
    "",
    "VERMELHA ",
    "",
    list("OTÁVIO MENDES ARRUDA"),
    list("LÍVIA BRANDÃO"),
    "",
    "AZUL CLARO",
    "",
    list("ÉRICO FONTES DA SILVA"),
    "",
    "MARRON",
    "",
    " ",
    "MARRON PONTA PRETA",
    "",
    "PRETA",
    "",
    list("TÚLIO ÂNGELO"),
    "",
    "LISTA PEDIDO DE KRUANGS ",
    "",
    "(03 UNIDADES) \tBRANCA PONTEIRA VERMELHA",
    "(02 UNIDADES) \tVERMELHA ",
    "(01 UNIDADE) \tAZUL CLARO",
    "(0 UNIDADES) \tMARRON",
    "(0 UNIDADES) \tMARRON PONTEIRA PRETA",
    "(01 UNIDADE) \tPRETA",
    "",
    "TOTAL: 7  KRUANGS",
  ];

  it("assigns each name to the heading above it, with continuous numbering", async () => {
    const result = await importDocx(blocks, { header: "RL FIGHT TEAM — DOCUMENTO INTERNO" });
    expect(result.structure).toBe("grouped");
    expect(result.students.map((s) => [s.name, s.graduationId])).toEqual([
      ["CAIO DOS REIS VALENTE MOURA DA LUZ", "branca-ponteira-vermelha"],
      ["DÉBORA RAMALHO TEIXEIRA", "branca-ponteira-vermelha"],
      ["ÍTALO QUEIROZ", "branca-ponteira-vermelha"],
      ["OTÁVIO MENDES ARRUDA", "vermelha"],
      ["LÍVIA BRANDÃO", "vermelha"],
      ["ÉRICO FONTES DA SILVA", "azul-claro"],
      ["TÚLIO ÂNGELO", "preta"],
    ]);
  });

  it("ignores the page header and reports the document title as ignored", async () => {
    const result = await importDocx(blocks, { header: "RL FIGHT TEAM — DOCUMENTO INTERNO" });
    expect(result.students.some((s) => s.name.includes("RL FIGHT"))).toBe(false);
    expect(result.notes).toContainEqual(expect.objectContaining({ kind: "ignored", text: "LISTA GRADUAÇÃO 2026.2" }));
  });

  it("recognises graduations without students", async () => {
    const result = await importDocx(blocks);
    const empty = result.notes.filter((n) => n.kind === "empty-graduation").map((n) => n.kind === "empty-graduation" && n.graduationId);
    expect(empty).toEqual(["marrom", "marrom-ponteira-preta"]);
  });

  it("reads the kruang order summary without mistaking quantities for students", async () => {
    const result = await importDocx(blocks);
    expect(result.students).toHaveLength(7);
    expect(result.summary?.total).toEqual({ quantity: 7, row: expect.any(Number) });
    expect(result.summary?.entries.map((e) => [e.graduationId, e.quantity])).toEqual([
      ["branca-ponteira-vermelha", 3],
      ["vermelha", 2],
      ["azul-claro", 1],
      ["marrom", 0],
      ["marrom-ponteira-preta", 0],
      ["preta", 1],
    ]);
    const check = reconcileSummary(result.summary!, studentsFromImport(result.students));
    expect(check.matches).toBe(true);
  });

  it("detects a divergence between the summary and the list", async () => {
    const changed = blocks.map((b) => (b === "(02 UNIDADES) \tVERMELHA " ? "(03 UNIDADES) \tVERMELHA " : b));
    const result = await importDocx(changed);
    const check = reconcileSummary(result.summary!, studentsFromImport(result.students));
    expect(check.matches).toBe(false);
    expect(check.rows.find((row) => row.graduationId === "vermelha")).toMatchObject({ expected: 3, actual: 2 });
  });
});

describe("DOCX import — manual numbering, ambiguity and tables", () => {
  it("accepts typed numbering that continues across graduations", async () => {
    const result = await importDocx([
      "BRANCA PONTEIRA VERMELHA",
      "1. MARCOS DA PAZ",
      "2. DAVI ROCHA",
      "VERMELHA",
      "3. JOANA MATOS",
      "AZUL CLARO",
      "4. NÍCOLAS COSTA",
    ]);
    expect(result.students.map((s) => `${s.name}:${s.graduationId}`)).toEqual([
      "MARCOS DA PAZ:branca-ponteira-vermelha",
      "DAVI ROCHA:branca-ponteira-vermelha",
      "JOANA MATOS:vermelha",
      "NÍCOLAS COSTA:azul-claro",
    ]);
  });

  it("never drops lines it cannot interpret and never invents graduations", async () => {
    const result = await importDocx([
      "GUSTAVO PROFESSOR CONVIDADO",
      "VERMELHA",
      list("ANA LIMA"),
      "Observação: trazer documento no dia: 12/12",
      "AZUL",
      list("BRUNO SALES"),
    ]);
    const unparsed = result.notes.filter((n) => n.kind === "unparsed");
    expect(unparsed.map((n) => n.text)).toContain("Observação: trazer documento no dia: 12/12");
    expect(result.notes).toContainEqual(expect.objectContaining({ kind: "unknown-graduation", text: "AZUL" }));
    expect(result.students.find((s) => s.name === "BRUNO SALES")).toMatchObject({ graduationId: null, graduationText: "AZUL" });
  });

  it("reports names that appear before any graduation instead of guessing", async () => {
    const result = await importDocx([list("CARLA NUNES"), "ROXA", list("DIEGO FARIAS")]);
    expect(result.students.map((s) => s.name)).toEqual(["DIEGO FARIAS"]);
    expect(result.notes).toContainEqual(expect.objectContaining({ kind: "unparsed", text: "CARLA NUNES" }));
  });

  it("reads a Word table with name and graduation columns", async () => {
    const result = await importDocx([
      "Turma de sábado",
      {
        table: [
          ["Nome", "Graduação"],
          ["Maria Oliveira", "Azul-claro"],
          ["João Silva", "Vermelha"],
        ],
      },
    ]);
    expect(result.structure).toBe("tabular");
    expect(result.students.map((s) => [s.name, s.graduationId])).toEqual([
      ["Maria Oliveira", "azul-claro"],
      ["João Silva", "vermelha"],
    ]);
  });

  it("keeps long compound names intact", async () => {
    const result = await importDocx(["ROXA", list("ANA CECÍLIA VASCONCELOS TORRES PINHEIRO DE ALBUQUERQUE")]);
    expect(result.students[0].name).toBe("ANA CECÍLIA VASCONCELOS TORRES PINHEIRO DE ALBUQUERQUE");
  });
});
