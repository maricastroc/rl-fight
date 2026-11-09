import JSZip from "jszip";

export async function buildZip(
  files: { name: string; bytes: Uint8Array }[],
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.bytes, { binary: true });
  // PDFs are already compressed internally; storing them keeps the ZIP fast to build.
  return zip.generateAsync({ type: "uint8array", compression: "STORE" }, (metadata) => onProgress?.(metadata.percent));
}
