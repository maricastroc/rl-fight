export type FontId = "tinos-bold-italic" | "tinos-bold" | "tinos-italic" | "tinos-regular";

/** Tinos is metrically compatible with Times New Roman, the typeface used on the original certificate. */
export const FONTS: Record<FontId, { label: string; file: string }> = {
  "tinos-bold-italic": { label: "Times · negrito itálico", file: "fonts/Tinos-BoldItalic.ttf" },
  "tinos-bold": { label: "Times · negrito", file: "fonts/Tinos-Bold.ttf" },
  "tinos-italic": { label: "Times · itálico", file: "fonts/Tinos-Italic.ttf" },
  "tinos-regular": { label: "Times · regular", file: "fonts/Tinos-Regular.ttf" },
};

export const FONT_IDS = Object.keys(FONTS) as FontId[];

export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && value in FONTS;
}
