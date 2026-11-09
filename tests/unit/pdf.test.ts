import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import JSZip from "jszip";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { generateBatch } from "@/lib/pdf/batch";
import { createCertificateEngine } from "@/lib/pdf/engine";
import { uniqueCertificateFileNames } from "@/lib/pdf/filenames";
import { fitText } from "@/lib/pdf/fit";
import { parseLayout, RL_FIGHT_TEAM_LAYOUT, scaleLayout, type CertificateValues } from "@/lib/pdf/template";

const templateBytes = new Uint8Array(readFileSync("public/templates/certificado-rl-fight-team.pdf"));
const fonts = { "tinos-bold-italic": new Uint8Array(readFileSync("public/fonts/Tinos-BoldItalic.ttf")) };
const field = (id: string) => RL_FIGHT_TEAM_LAYOUT.fields.find((f) => f.id === id)!;

const values = (overrides: Partial<CertificateValues> = {}): CertificateValues => ({
  nome: "Helena Duarte Abreu Bastos Siqueira",
  graduacao: "Branca ponteira vermelha",
  data: "28/06/2025",
  local: "Fortaleza/Ceará",
  ...overrides,
});

type TextItem = { str: string; x: number; y: number; size: number; width: number };

async function textItems(bytes: Uint8Array, pageNumber = 1): Promise<TextItem[]> {
  const task = getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false });
  const doc = await task.promise;
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.flatMap((item) =>
    "str" in item
      ? [{ str: item.str, x: item.transform[4], y: item.transform[5], size: Math.hypot(item.transform[0], item.transform[1]), width: item.width }]
      : [],
  );
  await task.destroy();
  return items;
}

async function render(overrides: Partial<CertificateValues> = {}) {
  const engine = await createCertificateEngine(templateBytes);
  return engine.render(values(overrides), RL_FIGHT_TEAM_LAYOUT, fonts);
}

function contentStreams(doc: PDFDocument): Uint8Array[] {
  const page = doc.getPage(0).node;
  const contents = page.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  return refs.map((ref) => {
    const stream = doc.context.lookup(ref as PDFRef) as PDFRawStream;
    return stream.contents;
  });
}

describe("certificate rendering", () => {
  it("keeps the page size and every original drawing operation untouched", async () => {
    const { bytes } = await render();
    const [original, generated] = await Promise.all([PDFDocument.load(templateBytes), PDFDocument.load(bytes)]);
    expect(generated.getPageCount()).toBe(1);
    expect(generated.getPage(0).getSize()).toEqual(original.getPage(0).getSize());

    // pdf-lib wraps the untouched original streams in q/Q and appends one stream with the fields.
    const originalStreams = contentStreams(original).map((bytes) => Buffer.from(bytes));
    const generatedStreams = contentStreams(generated).map((bytes) => Buffer.from(bytes));
    expect(generatedStreams).toHaveLength(originalStreams.length + 3);
    const start = generatedStreams.findIndex((stream) => stream.equals(originalStreams[0]));
    expect(start).toBe(1);
    originalStreams.forEach((stream, index) => expect(generatedStreams[start + index].equals(stream)).toBe(true));

    const xObjects = (doc: PDFDocument) =>
      (doc.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict)?.keys().length ?? 0);
    expect(xObjects(generated)).toBe(xObjects(original));
    expect(generated.getTitle()).toBe("Certificado — Helena Duarte Abreu Bastos Siqueira");
  });

  it("centres the name on its line at the configured baseline and size", async () => {
    const items = await textItems((await render()).bytes);
    const name = items.find((item) => item.str === "Helena Duarte Abreu Bastos Siqueira")!;
    const nome = field("nome");
    expect(name.size).toBeCloseTo(nome.size, 1);
    expect(name.y).toBeCloseTo(nome.y, 1);
    expect(name.x + name.width / 2).toBeCloseTo(nome.x + nome.width / 2, 0);
  });

  it("redraws the exam sentence exactly where the printed one was", async () => {
    const items = await textItems((await render()).bytes);
    const sentence = items.find((item) => item.str === "em exame realizado no dia 28/06/2025, em Fortaleza/Ceará.")!;
    expect(sentence.x).toBeCloseTo(145.05, 0);
    expect(sentence.y).toBeCloseTo(282.07, 1);
    expect(sentence.size).toBeCloseTo(22.24, 1);
  });

  it("paints the cover before any new text", async () => {
    const generated = await PDFDocument.load((await render()).bytes);
    const added = inflateSync(Buffer.from(contentStreams(generated).at(-1)!)).toString("latin1");
    const cover = added.indexOf("1 1 1 rg");
    expect(cover).toBeGreaterThan(-1);
    expect(added.slice(cover, added.indexOf("BT"))).toMatch(/1 0 0 1 126 275\.7 cm[\s\S]*578 22\.6 l[\s\S]*\nf\n/);
  });

  it("shrinks long names to fit, within the size limits", async () => {
    const longName = "RODRIGO AUGUSTO VALADARES BITTENCOURT DE MENEZES";
    const { bytes, fields } = await render({ nome: longName, graduacao: "Azul-claro ponteira azul-escura" });
    const items = await textItems(bytes);
    const nome = field("nome");
    const name = items.find((item) => item.str === longName)!;
    expect(name.size).toBeLessThan(nome.size);
    expect(name.size).toBeGreaterThanOrEqual(nome.minSize);
    expect(name.x).toBeGreaterThanOrEqual(nome.x - 0.5);
    expect(name.x + name.width).toBeLessThanOrEqual(nome.x + nome.width + 0.5);
    expect(fields.find((f) => f.fieldId === "nome")).toMatchObject({ shrunk: true, overflow: false });

    const graduacao = field("graduacao");
    const graduation = items.find((item) => item.str === "Azul-claro ponteira azul-escura")!;
    expect(graduation.y).toBeCloseTo(graduacao.y, 1);
    expect(graduation.x + graduation.width).toBeLessThanOrEqual(graduacao.x + graduacao.width + 0.5);
  });

  it("reports text that cannot fit even at the minimum size", async () => {
    const { fields } = await render({ nome: "Nome ".repeat(40).trim() });
    expect(fields.find((f) => f.fieldId === "nome")).toMatchObject({ overflow: true, size: field("nome").minSize });
  });

  it("embeds a font that keeps Portuguese accents searchable", async () => {
    const items = await textItems((await render({ nome: "Túlio Ângelo Gonçalves D’Ávila", local: "São Gonçalo do Amarante/Ceará" })).bytes);
    const strings = items.map((item) => item.str);
    expect(strings).toContain("Túlio Ângelo Gonçalves D’Ávila");
    expect(strings).toContain("em exame realizado no dia 28/06/2025, em São Gonçalo do Amarante/Ceará.");
  });

  it("replaces characters the font cannot draw instead of failing", async () => {
    const items = await textItems((await render({ nome: "Ana Paz ✶" })).bytes);
    expect(items.map((i) => i.str)).toContain("Ana Paz ?");
  });
});

describe("text fitting", () => {
  const measure = (size: number) => size * 10;
  it("keeps the preferred size when the text fits", () => {
    expect(fitText(measure, { x: 0, width: 300, align: "left", size: 20, minSize: 10 })).toEqual({ size: 20, width: 200, x: 0, overflow: false });
  });
  it("shrinks in quarter points and aligns", () => {
    const fitted = fitText(measure, { x: 100, width: 150, align: "right", size: 20, minSize: 10 });
    expect(fitted.size).toBe(15);
    expect(fitted.x).toBe(100);
    expect(fitText(measure, { x: 0, width: 160, align: "center", size: 20, minSize: 10 }).x).toBeCloseTo(0, 5);
  });
  it("stops at the minimum size and reports overflow", () => {
    expect(fitText(measure, { x: 0, width: 50, align: "left", size: 20, minSize: 10 })).toMatchObject({ size: 10, overflow: true });
  });
});

describe("layouts", () => {
  it("validates stored or imported layouts", () => {
    expect(parseLayout(JSON.parse(JSON.stringify(RL_FIGHT_TEAM_LAYOUT)))).toEqual(RL_FIGHT_TEAM_LAYOUT);
    expect(parseLayout({ fields: [{ id: "x" }] })).toBeNull();
    expect(parseLayout("nada")).toBeNull();
  });

  it("scales a layout to another page size", () => {
    const scaled = scaleLayout(RL_FIGHT_TEAM_LAYOUT, { width: 841.92, height: 595.32 }, { width: 420.96, height: 297.66 });
    expect(scaled.fields[0]).toMatchObject({ x: 140, width: 233, size: 12, cover: null });
  });
});

describe("files and batch", () => {
  it("creates predictable, collision-free file names", () => {
    expect(uniqueCertificateFileNames(["Maria Oliveira", "MARIA OLIVEIRA", "Maria Oliveira 2", "Ângela D’Ávila", ""])).toEqual([
      "certificado-maria-oliveira.pdf",
      "certificado-maria-oliveira-2.pdf",
      "certificado-maria-oliveira-2-2.pdf",
      "certificado-angela-davila.pdf",
      "certificado-aluno.pdf",
    ]);
  });

  it("produces a valid ZIP with one PDF per student and a combined print file", async () => {
    const names = ["Ana Lima", "Bruno Sá", "Ana Lima"];
    const graduations = ["Vermelha", "Roxa ponteira marrom", "Preta"];
    const fileNames = uniqueCertificateFileNames(names);
    const progress: string[] = [];
    const result = await generateBatch(
      {
        templateBytes,
        fonts,
        layout: RL_FIGHT_TEAM_LAYOUT,
        items: names.map((nome, i) => ({ values: values({ nome, graduacao: graduations[i] }), fileName: fileNames[i] })),
      },
      (p) => {
        progress.push(p.phase);
      },
    );

    expect(result.count).toBe(3);
    expect(progress.filter((p) => p === "certificates")).toHaveLength(3);
    expect(progress).toContain("zip");

    const zip = await JSZip.loadAsync(result.zip);
    expect(Object.keys(zip.files).sort()).toEqual(["certificado-ana-lima-2.pdf", "certificado-ana-lima.pdf", "certificado-bruno-sa.pdf"]);
    for (const name of Object.keys(zip.files)) {
      const pdf = await PDFDocument.load(await zip.files[name].async("uint8array"));
      expect(pdf.getPageCount()).toBe(1);
    }
    const second = await textItems(await zip.files["certificado-bruno-sa.pdf"].async("uint8array"));
    expect(second.map((i) => i.str)).toContain("Bruno Sá");

    const combined = await PDFDocument.load(result.combined);
    expect(combined.getPageCount()).toBe(3);

    // Every page of the print file carries only its own student, over the untouched template.
    const drawn = new Set([...names, ...graduations]);
    for (let page = 1; page <= 3; page++) {
      const strings = (await textItems(result.combined, page)).map((item) => item.str).filter((str) => drawn.has(str));
      expect(strings).toEqual([names[page - 1], graduations[page - 1]]);
    }
    const contentLists = combined.getPages().map((page) => page.node.Contents());
    expect(new Set(contentLists).size).toBe(3);
    expect(result.combined.byteLength).toBeLessThan(templateBytes.byteLength * 1.5);
  });
});
