import { getGraduation } from "../graduations/catalog";
import type { CertificateValues } from "../pdf/template";
import type { Student } from "../students/model";
import { applyNameCase } from "../text/name-case";
import { formatExamDate, formatLocation, type CertificateConfig } from "./config";

export function certificateValues(student: Pick<Student, "name" | "graduation">, config: CertificateConfig): CertificateValues {
  return {
    nome: applyNameCase(student.name.trim(), config.nameCase),
    graduacao: getGraduation(student.graduation)?.label ?? "",
    data: formatExamDate(config.examDate, config.dateStyle),
    local: formatLocation(config.city, config.state),
  };
}
