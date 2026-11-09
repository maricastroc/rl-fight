import mammoth from "mammoth";
import type { ExtractedSource, SourceRow } from "./types";

type DocElement = {
  type: string;
  value?: string;
  children?: DocElement[];
  numbering?: { isOrdered: boolean; level: string } | null;
};

function collectText(element: DocElement): string {
  switch (element.type) {
    case "text":
      return element.value ?? "";
    case "tab":
      return "\t";
    case "break":
      return "\n";
    default:
      return (element.children ?? []).map(collectText).join("");
  }
}

function cellText(cell: DocElement): string {
  return (cell.children ?? [])
    .map(collectText)
    .join(" ")
    .replace(/[\t\n]+/g, " ");
}

/**
 * Reads paragraphs and table rows from a .docx, keeping Word list membership.
 * Headers, footers, footnotes and comments are not part of the body and are skipped.
 */
export async function extractDocx(data: ArrayBuffer): Promise<ExtractedSource> {
  const rows: SourceRow[] = [];
  let position = 0;

  const visit = (element: DocElement) => {
    if (element.type === "paragraph") {
      position += 1;
      const listItem = Boolean(element.numbering);
      for (const line of collectText(element).split("\n")) {
        rows.push({ index: position, cells: line.split("\t"), listItem });
      }
      return;
    }
    if (element.type === "table") {
      for (const row of element.children ?? []) {
        if (row.type !== "tableRow") continue;
        position += 1;
        rows.push({ index: position, cells: (row.children ?? []).map(cellText) });
      }
      return;
    }
    for (const child of element.children ?? []) visit(child);
  };

  const input = { arrayBuffer: data, buffer: data } as unknown as Parameters<typeof mammoth.convertToHtml>[0];
  await mammoth.convertToHtml(input, {
    transformDocument: (document: DocElement) => {
      visit(document);
      return document;
    },
    convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
  });

  return { format: "docx", sheets: [{ name: "Documento", rows }] };
}
