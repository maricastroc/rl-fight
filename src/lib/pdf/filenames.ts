import { slugify } from "../text/slug";

export function certificateFileName(studentName: string): string {
  return `certificado-${slugify(studentName) || "aluno"}.pdf`;
}

/** File names in list order; repeated names get -2, -3… in the order they appear. */
export function uniqueCertificateFileNames(studentNames: string[]): string[] {
  const used = new Set<string>();
  return studentNames.map((name) => {
    const base = certificateFileName(name).replace(/\.pdf$/, "");
    let candidate = `${base}.pdf`;
    for (let suffix = 2; used.has(candidate); suffix++) candidate = `${base}-${suffix}.pdf`;
    used.add(candidate);
    return candidate;
  });
}
