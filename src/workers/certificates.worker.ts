import { generateBatch, type BatchInput } from "@/lib/pdf/batch";

type WorkerScope = {
  onmessage: ((event: MessageEvent<BatchInput>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event) => {
  try {
    const result = await generateBatch(event.data, (progress) => scope.postMessage({ type: "progress", progress }));
    scope.postMessage({ type: "done", result }, [result.zip.buffer as ArrayBuffer, result.combined.buffer as ArrayBuffer]);
  } catch (error) {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
