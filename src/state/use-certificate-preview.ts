"use client";

import { useEffect, useState } from "react";
import { loadFontsFor } from "@/lib/browser/assets";
import type { FieldResult } from "@/lib/pdf/engine";
import type { CertificateValues, TemplateLayout } from "@/lib/pdf/template";
import { useTemplate } from "./template";

export type PreviewState = {
  bytes: Uint8Array | null;
  fields: FieldResult[];
  status: "idle" | "rendering" | "ready" | "error";
  error: string | null;
};

/** Renders the real certificate PDF for the given values; the result feeds the PDF.js preview. */
export function useCertificatePreview(values: CertificateValues | null, layoutOverride?: TemplateLayout, delay = 90): PreviewState {
  const { engine, layout: activeLayout } = useTemplate();
  const layout = layoutOverride ?? activeLayout;
  const [state, setState] = useState<PreviewState>({ bytes: null, fields: [], status: "idle", error: null });

  const valuesKey = values ? JSON.stringify(values) : "";

  useEffect(() => {
    if (!engine || !values) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((previous) => ({ ...previous, status: "rendering" }));
      try {
        const fonts = await loadFontsFor(layout);
        const rendered = await engine.render(values, layout, fonts);
        if (!cancelled) setState({ bytes: rendered.bytes, fields: rendered.fields, status: "ready", error: null });
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            status: "error",
            error: error instanceof Error ? error.message : "Falha ao gerar a prévia.",
          }));
        }
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // valuesKey captures the content of `values`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, valuesKey, layout, delay]);

  return state;
}
