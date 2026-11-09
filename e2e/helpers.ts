import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import type { DocxBlock } from "../tests/helpers/ooxml";

export const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pdf: "application/pdf",
};

export async function upload(page: Page, name: string, bytes: Uint8Array, mimeType: string) {
  await page.getByTestId("file-input").setInputFiles({ name, mimeType, buffer: Buffer.from(bytes) });
}

export async function downloadBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  return readFile(path);
}

const list = (text: string): DocxBlock => ({ text, list: true });

/** A fictional class with the same structure as the teachers' real Word lists. */
export const CLASS_DOCX: DocxBlock[] = [
  "LISTA GRADUAÇÃO 2026.2",
  "",
  "BRANCA PONTEIRA VERMELHA",
  list("CAIO DOS REIS VALENTE"),
  list("DÉBORA RAMALHO TEIXEIRA"),
  "",
  "VERMELHA",
  list("OTÁVIO MENDES ARRUDA"),
  list("LÍVIA BRANDÃO"),
  "",
  "AZUL CLARO PONTEIRA AZUL ESCURA",
  list("ANA CECÍLIA VASCONCELOS TORRES PINHEIRO"),
  "",
  "PRETA",
  list("TÚLIO ÂNGELO"),
  "",
  "LISTA PEDIDO DE KRUANGS",
  "(02 UNIDADES) \tBRANCA PONTEIRA VERMELHA",
  "(02 UNIDADES) \tVERMELHA",
  "(01 UNIDADE) \tAZUL CLARO PONTEIRA AZUL ESCURA",
  "(01 UNIDADE) \tPRETA",
  "TOTAL: 6 KRUANGS",
];
