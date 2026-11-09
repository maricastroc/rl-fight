import fontkit from "@pdf-lib/fontkit";
import { PDFArray, PDFDocument, PDFName, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { fitText } from "./fit";
import type { FontId } from "./fonts";
import { fillPlaceholders, type CertificateValues, type TemplateField, type TemplateLayout } from "./template";

export type FontBytes = Partial<Record<FontId, Uint8Array>>;

export type FieldResult = { fieldId: string; text: string; size: number; overflow: boolean; shrunk: boolean };

export type RenderedCertificate = { bytes: Uint8Array; fields: FieldResult[] };

export type CertificateEngine = {
  pageSize: { width: number; height: number };
  render(values: CertificateValues, layout: TemplateLayout, fonts: FontBytes): Promise<RenderedCertificate>;
  renderCombined(
    items: CertificateValues[],
    layout: TemplateLayout,
    fonts: FontBytes,
    onProgress?: (done: number) => void | Promise<void>,
  ): Promise<Uint8Array>;
};

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function sanitizeForFont(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.normalize("NFC"))
    .map((char) => (supported.has(char.codePointAt(0) ?? 0) ? char : char === " " ? " " : "?"))
    .join("");
}

class FontCache {
  private readonly embedded = new Map<FontId, Promise<PDFFont>>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: FontBytes,
  ) {}

  get(id: FontId): Promise<PDFFont> {
    let font = this.embedded.get(id);
    if (!font) {
      const bytes = this.fonts[id];
      if (!bytes) throw new Error(`Fonte não carregada: ${id}`);
      font = this.doc.embedFont(bytes, { subset: true });
      this.embedded.set(id, font);
    }
    return font;
  }
}

async function drawFields(page: PDFPage, fields: TemplateField[], values: CertificateValues, fonts: FontCache): Promise<FieldResult[]> {
  for (const field of fields) {
    if (!field.cover) continue;
    const { x, y, width, height, color } = field.cover;
    page.drawRectangle({ x, y, width, height, color: hexToRgb(color), borderWidth: 0 });
  }

  const results: FieldResult[] = [];
  for (const field of fields) {
    const font = await fonts.get(field.font);
    const text = sanitizeForFont(fillPlaceholders(field.text, values).replace(/\s+/g, " ").trim(), font);
    if (!text) {
      results.push({ fieldId: field.id, text, size: field.size, overflow: false, shrunk: false });
      continue;
    }
    const fitted = fitText((size) => font.widthOfTextAtSize(text, size), field);
    page.drawText(text, { x: fitted.x, y: field.y, size: fitted.size, font, color: hexToRgb(field.color) });
    results.push({
      fieldId: field.id,
      text,
      size: fitted.size,
      overflow: fitted.overflow,
      shrunk: fitted.size < field.size,
    });
  }
  return results;
}

/**
 * Copies of the same template page share the original's content list (pdf-lib caches copied
 * objects), so text drawn on one page would show up on all of them. Each page gets its own list,
 * still pointing to the same untouched template streams.
 */
function ownContentList(page: PDFPage): void {
  const contents = page.node.Contents();
  if (contents instanceof PDFArray) {
    page.node.set(PDFName.of("Contents"), page.doc.context.obj(contents.asArray()));
  }
}

async function newDocument(title: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setLanguage("pt-BR");
  doc.setCreator("Kruang — certificados de graduação");
  doc.setProducer("pdf-lib");
  return doc;
}

/** Loads the template once; every certificate copies its first page untouched and draws the fields on top. */
export async function createCertificateEngine(templateBytes: Uint8Array): Promise<CertificateEngine> {
  const template = await PDFDocument.load(templateBytes, { updateMetadata: false });
  if (template.getPageCount() === 0) throw new Error("O modelo de certificado não tem páginas.");
  const { width, height } = template.getPage(0).getSize();

  return {
    pageSize: { width, height },

    async render(values, layout, fonts) {
      const doc = await newDocument(`Certificado — ${values.nome}`);
      const [page] = await doc.copyPages(template, [0]);
      doc.addPage(page);
      const fields = await drawFields(page, layout.fields, values, new FontCache(doc, fonts));
      return { bytes: await doc.save(), fields };
    },

    async renderCombined(items, layout, fonts, onProgress) {
      const doc = await newDocument("Certificados de graduação");
      const fontCache = new FontCache(doc, fonts);
      const pages = await doc.copyPages(template, items.map(() => 0));
      for (let index = 0; index < items.length; index++) {
        ownContentList(pages[index]);
        doc.addPage(pages[index]);
        await drawFields(pages[index], layout.fields, items[index], fontCache);
        await onProgress?.(index + 1);
      }
      return doc.save();
    },
  };
}
