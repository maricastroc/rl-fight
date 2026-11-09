import { describe, expect, it } from "vitest";
import { editDistance } from "@/lib/text/distance";
import { applyNameCase, toTitleCasePtBr } from "@/lib/text/name-case";
import { cleanPersonName, collapseSpaces, foldKey, stripListMarker } from "@/lib/text/normalize";
import { slugify } from "@/lib/text/slug";

describe("text normalisation", () => {
  it("collapses non-breaking and repeated spaces", () => {
    expect(collapseSpaces("  ANA   BEATRIZ\tQUEIROZ  ")).toBe("ANA BEATRIZ QUEIROZ");
  });

  it("composes decomposed accents so names compare and render correctly", () => {
    expect(collapseSpaces("JOÃO")).toBe("JOÃO");
  });

  it("folds accents, case and punctuation for comparisons", () => {
    expect(foldKey("Hélio D’Ávila")).toBe(foldKey("HELIO D'AVILA"));
  });

  it.each([
    ["1.      ALINE PEIXOTO SAMPAIO ", "ALINE PEIXOTO SAMPAIO", true],
    ["12. BRENDA LEITE", "BRENDA LEITE", true],
    ["03 - CAIO MOTA", "CAIO MOTA", true],
    ["4) DORA LIMA", "DORA LIMA", true],
    ["• EVA RIOS", "EVA RIOS", true],
    ["FÁBIO SÁ", "FÁBIO SÁ", false],
  ])("removes list markers from %j", (input, expected, numbered) => {
    const result = stripListMarker(collapseSpaces(input));
    expect(result.text).toBe(expected);
    expect(result.numbered).toBe(numbered);
  });

  it("cleans names without destroying accents or apostrophes", () => {
    expect(cleanPersonName("7.   HÉLIO D’ÁVILA MACEDO NUNES ;")).toBe("HÉLIO D’ÁVILA MACEDO NUNES");
    expect(cleanPersonName("ÍCARO JOSÉ ")).toBe("ÍCARO JOSÉ");
    expect(cleanPersonName("PEDRO SOUZA JR.")).toBe("PEDRO SOUZA JR.");
  });
});

describe("name case", () => {
  it.each([
    ["HELENA DUARTE DOS SANTOS", "Helena Duarte dos Santos"],
    ["HÉLIO D’ÁVILA MACEDO", "Hélio D’Ávila Macedo"],
    ["JOÃO DA SILVA E SOUZA", "João da Silva e Souza"],
    ["ANA-LUÍSA ROCHA", "Ana-Luísa Rocha"],
    ["PEDRO HENRIQUE II", "Pedro Henrique II"],
    ["de souza", "De Souza"],
  ])("title-cases %j", (input, expected) => {
    expect(toTitleCasePtBr(input)).toBe(expected);
  });

  it("applies the configured mode", () => {
    expect(applyNameCase("Júlia Péres", "upper")).toBe("JÚLIA PÉRES");
    expect(applyNameCase("JÚLIA PÉRES", "original")).toBe("JÚLIA PÉRES");
  });
});

describe("helpers", () => {
  it("slugifies names for file names", () => {
    expect(slugify("Maria Oliveira")).toBe("maria-oliveira");
    expect(slugify("JOÃO D’ÁVILA  Júnior")).toBe("joao-davila-junior");
  });

  it("computes edit distance with transpositions", () => {
    expect(editDistance("grau", "gral")).toBe(1);
    expect(editDistance("vermelha", "vemrelha")).toBe(1);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
  });
});
