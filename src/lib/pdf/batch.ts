import { createCertificateEngine, type FontBytes } from "./engine";
import { buildZip } from "./zip";
import type { CertificateValues, TemplateLayout } from "./template";

export type BatchItem = { values: CertificateValues; fileName: string };

export type BatchInput = {
  templateBytes: Uint8Array;
  fonts: FontBytes;
  layout: TemplateLayout;
  items: BatchItem[];
};

export type BatchProgress =
  | { phase: "certificates"; done: number; total: number; current: string }
  | { phase: "combined"; done: number; total: number }
  | { phase: "zip"; percent: number };

export type BatchResult = {
  zip: Uint8Array;
  combined: Uint8Array;
  count: number;
  /** Names whose text did not fit a field even at the minimum size. */
  overflow: string[];
};

/** Renders every certificate, a single print-ready PDF and a ZIP with the individual files. */
export async function generateBatch(
  input: BatchInput,
  onProgress: (progress: BatchProgress) => void | Promise<void> = () => {},
): Promise<BatchResult> {
  const engine = await createCertificateEngine(input.templateBytes);
  const total = input.items.length;
  const files: { name: string; bytes: Uint8Array }[] = [];
  const overflow: string[] = [];

  for (let index = 0; index < total; index++) {
    const item = input.items[index];
    const rendered = await engine.render(item.values, input.layout, input.fonts);
    if (rendered.fields.some((field) => field.overflow)) overflow.push(item.values.nome);
    files.push({ name: item.fileName, bytes: rendered.bytes });
    await onProgress({ phase: "certificates", done: index + 1, total, current: item.values.nome });
  }

  const combined = await engine.renderCombined(
    input.items.map((item) => item.values),
    input.layout,
    input.fonts,
    (done) => onProgress({ phase: "combined", done, total }),
  );

  const zip = await buildZip(files, (percent) => void onProgress({ phase: "zip", percent }));
  return { zip, combined, count: total, overflow };
}
