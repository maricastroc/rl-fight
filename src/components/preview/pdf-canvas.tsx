"use client";

import { useEffect, useRef, useState } from "react";
import { loadPdfJs } from "@/lib/browser/pdfjs";
import { cn } from "@/components/ui/cn";

type PdfCanvasProps = {
  bytes: Uint8Array | null;
  /** Display width in CSS pixels. */
  width: number;
  label: string;
  className?: string;
  onRendered?: () => void;
};

/**
 * Draws page 1 of a PDF with PDF.js. Rendering happens off-screen and is swapped in at once,
 * so moving between certificates never flashes a blank page.
 */
export function PdfCanvas({ bytes, width, label, className, onRendered }: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  useEffect(() => {
    const visible = canvasRef.current;
    if (!bytes || !visible || width <= 0) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    let cancelTask: (() => void) | undefined;

    (async () => {
      try {
        const { pdfjs, worker } = await loadPdfJs();
        const task = pdfjs.getDocument({ data: bytes.slice(), worker });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        const page = await doc.getPage(1);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: (width / base.width) * pixelRatio });
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.round(viewport.width);
        offscreen.height = Math.round(viewport.height);
        const renderTask = page.render({ canvas: offscreen, viewport });
        cancelTask = () => renderTask.cancel();
        await renderTask.promise;
        if (cancelled) return;

        visible.width = offscreen.width;
        visible.height = offscreen.height;
        visible.getContext("2d")?.drawImage(offscreen, 0, 0);
        setAspect(base.height / base.width);
        setFailed(false);
        onRenderedRef.current?.();
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cancelTask?.();
      destroy?.();
    };
  }, [bytes, width]);

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={cn("block bg-white", className)}
        style={{ width, height: aspect ? width * aspect : undefined }}
      />
      {failed && (
        <p role="alert" className="absolute inset-0 grid place-items-center text-sm text-signal-300">
          Não foi possível exibir a prévia.
        </p>
      )}
    </>
  );
}
