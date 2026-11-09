import { describe, expect, it } from "vitest";
import { decodeText } from "@/lib/import/extract-csv";
import { detectFormat, interpretSource, readSource } from "@/lib/import/import-file";
import { ImportError } from "@/lib/import/types";
import { encodeWindows1252, fileFrom } from "../helpers/ooxml";

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("CSV import", () => {
  it("reads semicolon-separated files saved with a UTF-8 BOM", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("Nome;Graduação\nMaria Oliveira;Azul-claro\nJoão Silva;Vermelha\n")]);
    const source = await readSource(fileFrom("turma.csv", bytes));
    expect(source.delimiter).toBe(";");
    expect(source.encoding).toBe("UTF-8");
    const { interpretation } = interpretSource(source);
    expect(interpretation.students.map((s) => [s.name, s.graduationId])).toEqual([
      ["Maria Oliveira", "azul-claro"],
      ["João Silva", "vermelha"],
    ]);
  });

  it("decodes Windows-1252 files exported by Excel in Portuguese", async () => {
    const bytes = encodeWindows1252("Aluno;Faixa\r\nCéSAR ÁVILA PEÇANHA;Marrom ponteira preta\r\nLÚCIA ARAÚJO;Roxa\r\n");
    const source = await readSource(fileFrom("turma.csv", bytes));
    expect(source.encoding).toBe("Windows-1252");
    const { interpretation } = interpretSource(source);
    expect(interpretation.students.map((s) => s.name)).toEqual(["CéSAR ÁVILA PEÇANHA", "LÚCIA ARAÚJO"]);
    expect(interpretation.students[0].graduationId).toBe("marrom-ponteira-preta");
  });

  it("reads comma-separated files with quoted values", async () => {
    const source = await readSource(fileFrom("turma.csv", utf8('nome,graduação\n"Silva, Ana",Preta\nRui Costa,Roxa\n')));
    expect(source.delimiter).toBe(",");
    expect(interpretSource(source).interpretation.students.map((s) => s.name)).toEqual(["Silva, Ana", "Rui Costa"]);
  });

  it("reads a single-column grouped list", async () => {
    const source = await readSource(fileFrom("lista.csv", utf8("VERMELHA\nAna Prado\nBeto Lins\n\nAZUL ESCURA\nCaio Reis\n")));
    expect(interpretSource(source).interpretation.students.map((s) => `${s.name}:${s.graduationId}`)).toEqual([
      "Ana Prado:vermelha",
      "Beto Lins:vermelha",
      "Caio Reis:azul-escura",
    ]);
  });

  it("decodes UTF-16 text files", () => {
    const text = "Nome\tGraduação\nÍris\tRoxa";
    const bytes = new Uint8Array([0xff, 0xfe, ...Array.from(text).flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])]);
    expect(decodeText(bytes)).toEqual({ text, encoding: "UTF-16" });
  });
});

describe("file validation", () => {
  it("explains legacy Office files", () => {
    expect(() => detectFormat("lista.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toThrow(ImportError);
    expect(() => detectFormat("lista.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toThrow(/Salvar como/);
  });

  it("rejects unsupported and corrupted files with a clear message", async () => {
    expect(() => detectFormat("certificado.pdf", utf8("%PDF-1.7"))).toThrow(/Formato não suportado/);
    expect(() => detectFormat("lista.docx", utf8("not a zip"))).toThrow(/corrompido/);
    await expect(readSource(fileFrom("vazio.csv", new Uint8Array()))).rejects.toThrow(/vazio/);
    await expect(readSource(fileFrom("lista.xlsx", new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])))).rejects.toThrow(/Não foi possível ler/);
  });
});
