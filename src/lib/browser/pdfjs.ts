import { assetUrl } from "./assets";

type PdfJs = typeof import("pdfjs-dist");
type PdfWorker = InstanceType<PdfJs["PDFWorker"]>;

let loader: Promise<{ pdfjs: PdfJs; worker: PdfWorker }> | null = null;

/**
 * Loads PDF.js on demand with a single shared worker, so every preview reuses it instead of
 * spinning up a new one. The worker file is copied to /vendor by scripts/copy-pdf-worker.mjs.
 */
export function loadPdfJs(): Promise<{ pdfjs: PdfJs; worker: PdfWorker }> {
  loader ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = assetUrl("vendor/pdf.worker.min.mjs");
    return { pdfjs, worker: new pdfjs.PDFWorker() };
  });
  return loader;
}
