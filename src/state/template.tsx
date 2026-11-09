"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchBytes } from "@/lib/browser/assets";
import {
  deleteStoredTemplate,
  loadStoredTemplate,
  readJson,
  removeKey,
  saveStoredTemplate,
  writeJson,
  type StoredTemplate,
} from "@/lib/browser/storage";
import type { CertificateEngine } from "@/lib/pdf/engine";
import { BUILT_IN_TEMPLATES, parseLayout, scaleLayout, type PageSize, type TemplateLayout } from "@/lib/pdf/template";
import { useSession } from "./session";

export const CUSTOM_TEMPLATE_ID = "custom";
const DEFAULT_TEMPLATE = BUILT_IN_TEMPLATES[0];
const layoutKey = (id: string) => `kruang:layout:${id}`;

/** pdf-lib is only needed once a template is used, so it is loaded in the background. */
async function createEngine(bytes: Uint8Array): Promise<CertificateEngine> {
  const { createCertificateEngine } = await import("@/lib/pdf/engine");
  return createCertificateEngine(bytes);
}
const MAX_TEMPLATE_SIZE = 25 * 1024 * 1024;

export type TemplateOption = { id: string; name: string; description: string; custom: boolean };

type Loaded = { id: string; bytes: Uint8Array; engine: CertificateEngine };

type TemplateContextValue = {
  options: TemplateOption[];
  active: TemplateOption;
  status: "loading" | "ready" | "error";
  error: string | null;
  bytes: Uint8Array | null;
  engine: CertificateEngine | null;
  pageSize: PageSize | null;
  layout: TemplateLayout;
  defaultLayout: TemplateLayout;
  isLayoutCustomized: boolean;
  setLayout: (layout: TemplateLayout) => void;
  resetLayout: () => void;
  selectTemplate: (id: string) => void;
  uploadTemplate: (file: File) => Promise<void>;
  removeCustomTemplate: () => Promise<void>;
};

const TemplateContext = createContext<TemplateContextValue | null>(null);

function readStoredLayouts(): Record<string, TemplateLayout> {
  const stored: Record<string, TemplateLayout> = {};
  for (const id of [...BUILT_IN_TEMPLATES.map((t) => t.id), CUSTOM_TEMPLATE_ID]) {
    const layout = parseLayout(readJson(layoutKey(id)));
    if (layout) stored[id] = layout;
  }
  return stored;
}

function describeLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/encrypt/i.test(message)) return "Este PDF está protegido por senha e não pode ser usado como modelo.";
  return "Não foi possível abrir este PDF. Exporte o certificado novamente como PDF e tente de novo.";
}

export function TemplateProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useSession();
  const [custom, setCustom] = useState<StoredTemplate | null>(null);
  const [customChecked, setCustomChecked] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TemplateLayout>>({});

  const requestedId = state.config.templateId;
  const activeId = requestedId === CUSTOM_TEMPLATE_ID && customChecked && !custom ? DEFAULT_TEMPLATE.id : requestedId;

  useEffect(() => {
    let cancelled = false;
    loadStoredTemplate(CUSTOM_TEMPLATE_ID).then((stored) => {
      if (cancelled) return;
      setOverrides(readStoredLayouts());
      setCustom(stored);
      setCustomChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeId === CUSTOM_TEMPLATE_ID && !customChecked) return;
    let cancelled = false;
    const source =
      activeId === CUSTOM_TEMPLATE_ID && custom
        ? Promise.resolve(custom.bytes)
        : fetchBytes((BUILT_IN_TEMPLATES.find((t) => t.id === activeId) ?? DEFAULT_TEMPLATE).file);
    source
      .then(async (bytes) => {
        const engine = await createEngine(bytes);
        if (!cancelled) setLoaded({ id: activeId, bytes, engine });
      })
      .catch((reason) => {
        if (!cancelled) setError({ id: activeId, message: describeLoadError(reason) });
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, custom, customChecked]);

  const current = loaded?.id === activeId ? loaded : null;
  const pageSize = current?.engine.pageSize ?? null;
  const builtIn = BUILT_IN_TEMPLATES.find((t) => t.id === activeId);

  const defaultLayout = useMemo(() => {
    if (builtIn) return builtIn.layout;
    const from = { width: 841.92, height: 595.32 };
    return scaleLayout(DEFAULT_TEMPLATE.layout, from, pageSize ?? from);
  }, [builtIn, pageSize]);

  const layout = overrides[activeId] ?? defaultLayout;

  const setLayout = useCallback(
    (next: TemplateLayout) => {
      setOverrides((all) => ({ ...all, [activeId]: next }));
      writeJson(layoutKey(activeId), next);
    },
    [activeId],
  );

  const resetLayout = useCallback(() => {
    setOverrides((all) => {
      const next = { ...all };
      delete next[activeId];
      return next;
    });
    removeKey(layoutKey(activeId));
  }, [activeId]);

  const selectTemplate = useCallback((id: string) => dispatch({ type: "config", patch: { templateId: id } }), [dispatch]);

  const uploadTemplate = useCallback(
    async (file: File) => {
      if (file.size > MAX_TEMPLATE_SIZE) throw new Error("O PDF tem mais de 25 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let engine: CertificateEngine;
      try {
        engine = await createEngine(bytes);
      } catch (reason) {
        throw new Error(describeLoadError(reason));
      }
      const stored: StoredTemplate = {
        name: file.name.replace(/\.pdf$/i, ""),
        fileName: file.name,
        bytes,
        savedAt: Date.now(),
      };
      try {
        await saveStoredTemplate(CUSTOM_TEMPLATE_ID, stored);
      } catch {
        throw new Error("O navegador não permitiu guardar o modelo. Verifique se o modo privado está desativado.");
      }
      const scaled = scaleLayout(DEFAULT_TEMPLATE.layout, { width: 841.92, height: 595.32 }, engine.pageSize);
      setOverrides((all) => ({ ...all, [CUSTOM_TEMPLATE_ID]: scaled }));
      writeJson(layoutKey(CUSTOM_TEMPLATE_ID), scaled);
      setCustom(stored);
      setCustomChecked(true);
      setLoaded({ id: CUSTOM_TEMPLATE_ID, bytes, engine });
      dispatch({ type: "config", patch: { templateId: CUSTOM_TEMPLATE_ID } });
    },
    [dispatch],
  );

  const removeCustomTemplate = useCallback(async () => {
    await deleteStoredTemplate(CUSTOM_TEMPLATE_ID).catch(() => undefined);
    removeKey(layoutKey(CUSTOM_TEMPLATE_ID));
    setOverrides((all) => {
      const next = { ...all };
      delete next[CUSTOM_TEMPLATE_ID];
      return next;
    });
    setCustom(null);
    dispatch({ type: "config", patch: { templateId: DEFAULT_TEMPLATE.id } });
  }, [dispatch]);

  const options = useMemo<TemplateOption[]>(() => {
    const builtIns = BUILT_IN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, custom: false }));
    if (!custom) return builtIns;
    return [
      ...builtIns,
      { id: CUSTOM_TEMPLATE_ID, name: custom.name, description: `PDF enviado · ${custom.fileName}`, custom: true },
    ];
  }, [custom]);

  const active = options.find((option) => option.id === activeId) ?? options[0];
  const currentError = error?.id === activeId ? error.message : null;

  const value: TemplateContextValue = {
    options,
    active,
    status: current ? "ready" : currentError ? "error" : "loading",
    error: currentError,
    bytes: current?.bytes ?? null,
    engine: current?.engine ?? null,
    pageSize,
    layout,
    defaultLayout,
    isLayoutCustomized: Boolean(overrides[activeId]),
    setLayout,
    resetLayout,
    selectTemplate,
    uploadTemplate,
    removeCustomTemplate,
  };

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
}

export function useTemplate(): TemplateContextValue {
  const context = useContext(TemplateContext);
  if (!context) throw new Error("useTemplate must be used inside TemplateProvider");
  return context;
}
