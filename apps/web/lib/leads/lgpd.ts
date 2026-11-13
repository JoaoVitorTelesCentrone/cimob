const brDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Nome do arquivo da exportação LGPD: "dados-lead-<nome>-<data de Brasília>.json". */
export function exportFileName(name: string | null, now: Date): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `dados-lead-${slug || "sem-nome"}-${brDate.format(now)}.json`;
}
