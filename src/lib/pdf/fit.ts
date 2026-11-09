import type { TemplateField } from "./template";

export type FittedText = { size: number; width: number; x: number; overflow: boolean };

/**
 * Picks the largest size between field.minSize and field.size that fits field.width,
 * then positions the text according to the field alignment.
 * `measure` returns the text width at a given size (linear in size).
 */
export function fitText(measure: (size: number) => number, field: Pick<TemplateField, "x" | "width" | "align" | "size" | "minSize">): FittedText {
  let size = field.size;
  let width = measure(size);
  if (width > field.width) {
    size = Math.max(field.minSize, Math.floor(((field.size * field.width) / width) * 4) / 4);
    width = measure(size);
    while (width > field.width && size - 0.25 >= field.minSize) {
      size -= 0.25;
      width = measure(size);
    }
  }

  const x =
    field.align === "left"
      ? field.x
      : field.align === "right"
        ? field.x + field.width - width
        : field.x + (field.width - width) / 2;

  return { size, width, x, overflow: width > field.width + 0.01 };
}
