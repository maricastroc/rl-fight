import type { FontBytes } from "../pdf/engine";
import { FONTS, type FontId } from "../pdf/fonts";
import type { TemplateLayout } from "../pdf/template";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetUrl(path: string): string {
  return `${BASE_PATH}/${path.replace(/^\/+/, "")}`;
}

export async function fetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Não foi possível carregar ${path} (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

const fontRequests = new Map<FontId, Promise<Uint8Array>>();

function loadFont(id: FontId): Promise<Uint8Array> {
  let request = fontRequests.get(id);
  if (!request) {
    request = fetchBytes(FONTS[id].file).catch((error) => {
      fontRequests.delete(id);
      throw error;
    });
    fontRequests.set(id, request);
  }
  return request;
}

/** Loads (once) every font referenced by the layout. */
export async function loadFontsFor(layout: TemplateLayout): Promise<FontBytes> {
  const ids = [...new Set(layout.fields.map((field) => field.font))];
  const loaded = await Promise.all(ids.map(async (id) => [id, await loadFont(id)] as const));
  return Object.fromEntries(loaded);
}
