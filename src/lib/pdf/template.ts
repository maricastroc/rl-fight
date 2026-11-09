import { isFontId, type FontId } from "./fonts";

export type TextAlign = "left" | "center" | "right";

export type FieldCover = { x: number; y: number; width: number; height: number; color: string };

/** A text field drawn over the template page. Coordinates are PDF points from the bottom-left corner. */
export type TemplateField = {
  id: string;
  label: string;
  /** Text with placeholders: {nome}, {graduacao}, {data}, {local}. */
  text: string;
  x: number;
  /** Baseline. */
  y: number;
  width: number;
  align: TextAlign;
  font: FontId;
  /** Preferred (maximum) size; long text shrinks down to minSize. */
  size: number;
  minSize: number;
  color: string;
  /** Rectangle painted before the text, used to hide text printed on the original artwork. */
  cover: FieldCover | null;
};

export type TemplateLayout = { fields: TemplateField[] };

export type CertificateValues = { nome: string; graduacao: string; data: string; local: string };

export const PLACEHOLDERS: { key: keyof CertificateValues; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "graduacao", label: "Graduação" },
  { key: "data", label: "Data" },
  { key: "local", label: "Local" },
];

export function fillPlaceholders(text: string, values: CertificateValues): string {
  return text.replace(/\{(nome|graduacao|data|local)\}/g, (_, key: keyof CertificateValues) => values[key]);
}

/**
 * Field positions measured on "certificado-rl-fight-team.pdf" (A4 landscape, 841.92 × 595.32 pt).
 * - Name sits on the line after "Certificamos que" (line from x 274.6 to 751.5 at y 368.2).
 * - Graduation sits on the line after "Kruang", sharing the sentence baseline (y 322.4); the
 *   white band ends near x 758, so the text stays left of it.
 * - The exam sentence is printed on the artwork with a fixed date; a white cover inside its white
 *   band hides it and the sentence is redrawn, centred where the original was.
 */
export const RL_FIGHT_TEAM_LAYOUT: TemplateLayout = {
  fields: [
    {
      id: "nome",
      label: "Nome do aluno",
      text: "{nome}",
      x: 280,
      y: 371.6,
      width: 466,
      align: "center",
      font: "tinos-bold-italic",
      size: 24,
      minSize: 13,
      color: "#000000",
      cover: null,
    },
    {
      id: "graduacao",
      label: "Graduação",
      text: "{graduacao}",
      x: 564,
      y: 322.4,
      width: 192,
      align: "center",
      font: "tinos-bold-italic",
      size: 22.24,
      minSize: 11,
      color: "#000000",
      cover: null,
    },
    {
      id: "exame",
      label: "Data e local do exame",
      text: "em exame realizado no dia {data}, em {local}.",
      x: 138.76,
      y: 282.07,
      width: 563,
      align: "center",
      font: "tinos-bold-italic",
      size: 22.24,
      minSize: 12,
      color: "#000000",
      cover: { x: 126, y: 275.7, width: 578, height: 22.6, color: "#FFFFFF" },
    },
  ],
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  /** Path relative to the site root. */
  file: string;
  layout: TemplateLayout;
};

export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  {
    id: "rl-fight-team",
    name: "RL Fight Team",
    description: "Certificado original · A4 paisagem",
    file: "templates/certificado-rl-fight-team.pdf",
    layout: RL_FIGHT_TEAM_LAYOUT,
  },
];

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function parseCover(value: unknown): FieldCover | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || value === undefined) return undefined;
  const cover = value as Record<string, unknown>;
  if (![cover.x, cover.y, cover.width, cover.height].every(isNumber) || !isHexColor(cover.color)) return undefined;
  return { x: cover.x as number, y: cover.y as number, width: cover.width as number, height: cover.height as number, color: cover.color as string };
}

function parseField(value: unknown): TemplateField | null {
  if (typeof value !== "object" || value === null) return null;
  const f = value as Record<string, unknown>;
  const cover = parseCover(f.cover);
  const valid =
    typeof f.id === "string" &&
    typeof f.label === "string" &&
    typeof f.text === "string" &&
    [f.x, f.y, f.width, f.size, f.minSize].every(isNumber) &&
    (f.align === "left" || f.align === "center" || f.align === "right") &&
    isFontId(f.font) &&
    isHexColor(f.color) &&
    cover !== undefined;
  if (!valid) return null;
  return {
    id: f.id as string,
    label: f.label as string,
    text: f.text as string,
    x: f.x as number,
    y: f.y as number,
    width: Math.max(1, f.width as number),
    align: f.align as TextAlign,
    font: f.font as FontId,
    size: Math.max(1, f.size as number),
    minSize: Math.max(1, Math.min(f.minSize as number, f.size as number)),
    color: f.color as string,
    cover: cover ?? null,
  };
}

/** Validates a layout coming from storage or an imported JSON file. */
export function parseLayout(value: unknown): TemplateLayout | null {
  if (typeof value !== "object" || value === null) return null;
  const fields = (value as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;
  const parsed = fields.map(parseField);
  if (parsed.some((field) => field === null)) return null;
  return { fields: parsed as TemplateField[] };
}

export type PageSize = { width: number; height: number };

/** Adapts a layout measured on one page size to another (used when a new PDF template is uploaded). */
export function scaleLayout(layout: TemplateLayout, from: PageSize, to: PageSize): TemplateLayout {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const s = Math.min(sx, sy);
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    fields: layout.fields.map((field) => ({
      ...field,
      x: round(field.x * sx),
      y: round(field.y * sy),
      width: round(field.width * sx),
      size: round(field.size * s),
      minSize: round(field.minSize * s),
      cover: null,
    })),
  };
}
