import { stripAccents } from "./normalize";

export function slugify(value: string): string {
  return stripAccents(value)
    .toLocaleLowerCase("pt-BR")
    .replace(/['’ʼ`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
