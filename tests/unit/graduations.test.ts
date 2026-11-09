import { describe, expect, it } from "vitest";
import { GRADUATIONS } from "@/lib/graduations/catalog";
import { matchGraduation } from "@/lib/graduations/match";

function idOf(text: string) {
  const match = matchGraduation(text);
  return match.kind === "match" ? { id: match.graduation.id, inferred: match.inferred } : match.kind;
}

describe("matchGraduation", () => {
  it("recognises every catalogue label exactly", () => {
    for (const graduation of GRADUATIONS) {
      expect(idOf(graduation.label)).toEqual({ id: graduation.id, inferred: false });
    }
  });

  it.each([
    ["BRANCA PONTEIRA VERMELHA", "branca-ponteira-vermelha"],
    ["branca ponteira vermelha", "branca-ponteira-vermelha"],
    ["Branco ponteira vermelha ", "branca-ponteira-vermelha"],
    ["VERMELHA ", "vermelha"],
    ["Vermelho", "vermelha"],
    ["VERMELHA PONTEIRA AZUL CLARO", "vermelha-ponteira-azul-claro"],
    ["AZUL CLARO", "azul-claro"],
    ["AZUL-CLARO", "azul-claro"],
    ["Azul  claro", "azul-claro"],
    ["AZUL CLARO PONTEIRA AZUL ESCURA", "azul-claro-ponteira-azul-escura"],
    ["Azul escuro", "azul-escura"],
    ["AZUL ESCURA PONTEIRA ROXA", "azul-escura-ponteira-roxa"],
    ["ROXA PONTEIRA MARRON ", "roxa-ponteira-marrom"],
    ["MARRON", "marrom"],
    ["MARROM", "marrom"],
    ["MARRON PONTA PRETA", "marrom-ponteira-preta"],
    ["Marrom c/ ponta preta", "marrom-ponteira-preta"],
    ["PRETA", "preta"],
    ["KRUANG VERMELHA", "vermelha"],
    ["Faixa roxa", "roxa"],
    ["VERMELHA (10)", "vermelha"],
    ["VERMELHA - 10 ALUNOS", "vermelha"],
  ])("accepts the spelling variant %j", (text, id) => {
    expect(idOf(text)).toEqual({ id, inferred: false });
  });

  it.each([
    ["GRAL PRETO", "preta"],
    ["VERMLHA", "vermelha"],
    ["Azul claro ponteira azul escura (nao recebeu)", "azul-claro-ponteira-azul-escura"],
  ])("flags %j as an inferred match that needs confirmation", (text, id) => {
    expect(idOf(text)).toEqual({ id, inferred: true });
  });

  it("keeps kruang-looking text that is ambiguous or outside the catalogue as unknown", () => {
    expect(idOf("AZUL")).toBe("unknown");
    expect(idOf("BRANCA")).toBe("unknown");
    expect(idOf("PRETA PONTEIRA BRANCA")).toBe("unknown");
    expect(idOf("VERMELHA AZUL")).toBe("unknown");
  });

  it("does not treat names, quantities or titles as graduations", () => {
    expect(idOf("MARIA DA SILVA")).toBe("none");
    expect(idOf("Rosa Maria Branco")).toBe("none");
    expect(idOf("ROSA")).toBe("none");
    expect(idOf("(19 UNIDADES) BRANCA PONTEIRA VERMELHA")).toBe("none");
    expect(idOf("LISTA GRADUAÇÃO 2025.2")).toBe("none");
    expect(idOf("")).toBe("none");
  });
});
