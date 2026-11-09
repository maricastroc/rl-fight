import type { BatchInput, BatchProgress, BatchResult } from "../pdf/batch";

type WorkerMessage =
  | { type: "progress"; progress: BatchProgress }
  | { type: "done"; result: BatchResult }
  | { type: "error"; message: string };

export type BatchRun = { promise: Promise<BatchResult>; cancel: () => void };

export class BatchCancelled extends Error {
  constructor() {
    super("Geração cancelada");
    this.name = "BatchCancelled";
  }
}

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Runs the batch on the main thread, yielding between certificates so the interface keeps painting. */
function runInline(input: BatchInput, onProgress: (p: BatchProgress) => void): BatchRun {
  let cancelled = false;
  const promise = import("../pdf/batch").then(({ generateBatch }) =>
    generateBatch(input, async (progress) => {
      if (cancelled) throw new BatchCancelled();
      onProgress(progress);
      await nextFrame();
    }),
  );
  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}

/** Generates certificates in a Web Worker, falling back to the main thread when workers are unavailable. */
export function runBatch(input: BatchInput, onProgress: (p: BatchProgress) => void): BatchRun {
  let worker: Worker;
  try {
    worker = new Worker(new URL("../../workers/certificates.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return runInline(input, onProgress);
  }

  let settle: { reject: (reason: unknown) => void } | null = null;
  let fallback: BatchRun | null = null;

  const promise = new Promise<BatchResult>((resolve, reject) => {
    settle = { reject };
    let started = false;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "progress") {
        started = true;
        onProgress(message.progress);
      } else if (message.type === "done") {
        worker.terminate();
        resolve(message.result);
      } else {
        worker.terminate();
        reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      if (started) {
        reject(new Error("A geração foi interrompida inesperadamente."));
        return;
      }
      fallback = runInline(input, onProgress);
      fallback.promise.then(resolve, reject);
    };
    worker.postMessage(input);
  });

  return {
    promise,
    cancel: () => {
      worker.terminate();
      fallback?.cancel();
      settle?.reject(new BatchCancelled());
    },
  };
}
