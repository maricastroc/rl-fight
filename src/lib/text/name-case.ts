export type NameCase = "original" | "upper" | "title";

const LOWERCASE_PARTICLES = new Set(["da", "das", "de", "di", "do", "dos", "du", "e", "y"]);
const ROMAN_NUMERAL = /^(?:i{1,3}|iv|v|vi{1,3}|ix|x)$/i;

function capitalize(word: string): string {
  if (!word) return word;
  const [first, ...rest] = Array.from(word);
  return first.toLocaleUpperCase("pt-BR") + rest.join("");
}

function titleCaseWord(word: string, isFirst: boolean): string {
  const lower = word.toLocaleLowerCase("pt-BR");
  if (!isFirst && LOWERCASE_PARTICLES.has(lower)) return lower;
  if (!isFirst && ROMAN_NUMERAL.test(word)) return word.toLocaleUpperCase("pt-BR");

  return lower
    .split(/(-)/)
    .map((part) => {
      const apostrophe = part.match(/^(\p{L}{1,2})(['’ʼ`])(\p{L}.*)$/u);
      if (apostrophe) {
        const [, prefix, mark, remainder] = apostrophe;
        return capitalize(prefix) + mark + capitalize(remainder);
      }
      return capitalize(part);
    })
    .join("");
}

/** Title case following Brazilian naming conventions ("Maria da Silva", "D’Ávila", "Pedro II"). */
export function toTitleCasePtBr(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word, index) => titleCaseWord(word, index === 0))
    .join(" ");
}

export function applyNameCase(name: string, mode: NameCase): string {
  if (mode === "upper") return name.toLocaleUpperCase("pt-BR");
  if (mode === "title") return toTitleCasePtBr(name);
  return name;
}
