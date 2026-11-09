import type { NameCase } from "../text/name-case";

export type DateStyle = "numeric" | "long";

export type CertificateConfig = {
  /** ISO date (yyyy-mm-dd). */
  examDate: string;
  dateStyle: DateStyle;
  city: string;
  /** Brazilian state code (UF), or "" to print only the city. */
  state: string;
  nameCase: NameCase;
  templateId: string;
};

export const DEFAULT_CERTIFICATE_CONFIG: CertificateConfig = {
  examDate: "",
  dateStyle: "numeric",
  city: "Fortaleza",
  state: "CE",
  nameCase: "title",
  templateId: "rl-fight-team",
};

export const BRAZILIAN_STATES = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
] as const;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function formatExamDate(iso: string, style: DateStyle): string {
  const parts = parseIsoDate(iso);
  if (!parts) return "";
  const { year, month, day } = parts;
  if (style === "numeric") {
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }
  return `${day === 1 ? "1º" : day} de ${MONTHS[month - 1]} de ${year}`;
}

export function weekdayOf(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) return "";
  return WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
}

export function stateName(code: string): string {
  return BRAZILIAN_STATES.find(([uf]) => uf === code)?.[1] ?? "";
}

export function formatLocation(city: string, stateCode: string): string {
  const cityName = city.trim().replace(/\s+/g, " ");
  const state = stateName(stateCode);
  if (!cityName) return state;
  return state ? `${cityName}/${state}` : cityName;
}

export function configProblems(config: CertificateConfig): { examDate?: string; city?: string } {
  return {
    examDate: !config.examDate
      ? "Informe a data do exame"
      : parseIsoDate(config.examDate)
        ? undefined
        : "Data inválida",
    city: config.city.trim() ? undefined : "Informe a cidade",
  };
}
