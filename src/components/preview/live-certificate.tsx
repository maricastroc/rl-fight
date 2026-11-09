"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/components/ui/cn";
import type { CertificateValues, TemplateLayout } from "@/lib/pdf/template";
import { useCertificatePreview, type PreviewState } from "@/state/use-certificate-preview";
import { useTemplate } from "@/state/template";
import { PdfCanvas } from "./pdf-canvas";
import { useElementSize } from "./use-element-size";

/** Skeleton shown while the first render of a certificate is not ready yet. */
function CertificateSkeleton({ aspect }: { aspect: number }) {
  return (
    <div className="relative overflow-hidden bg-ink-800" style={{ aspectRatio: `${1 / aspect}` }}>
      <span className="absolute inset-y-0 left-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-bone-50/[0.05] to-transparent" />
    </div>
  );
}

type LiveCertificateProps = {
  values: CertificateValues | null;
  label: string;
  layout?: TemplateLayout;
  className?: string;
  /** Width override (CSS px); defaults to the container width. */
  width?: number;
  onPreview?: (preview: PreviewState) => void;
};

/** The real certificate PDF for `values`, rendered by PDF.js and kept in sync with edits. */
export function LiveCertificate({ values, label, layout, className, width, onPreview }: LiveCertificateProps) {
  const { pageSize, status: templateStatus, error: templateError } = useTemplate();
  const preview = useCertificatePreview(values, layout);
  const [containerRef, container] = useElementSize<HTMLDivElement>();
  const displayWidth = width ?? container.width;
  const aspect = pageSize ? pageSize.height / pageSize.width : 595.32 / 841.92;

  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  });
  useEffect(() => {
    onPreviewRef.current?.(preview);
  }, [preview]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {templateStatus === "error" ? (
        <div role="alert" className="grid place-items-center bg-ink-850 p-8 text-center text-sm text-signal-300" style={{ aspectRatio: `${1 / aspect}` }}>
          {templateError}
        </div>
      ) : preview.bytes ? (
        <div className="relative">
          <PdfCanvas bytes={preview.bytes} width={displayWidth} label={label} className="shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]" />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 bg-ink-950/20 transition-opacity duration-300",
              preview.status === "rendering" ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      ) : (
        <CertificateSkeleton aspect={aspect} />
      )}
      {preview.status === "error" && (
        <p role="alert" className="mt-3 text-[13px] text-signal-300">
          {preview.error}
        </p>
      )}
    </div>
  );
}
