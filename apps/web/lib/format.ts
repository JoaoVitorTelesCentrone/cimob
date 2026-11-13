const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(date: Date | null): string {
  return date ? dateTime.format(date) : "—";
}

/** 5521988880003 → +55 (21) 98888-0003 */
export function formatPhone(phone: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(phone.replace(/\D/g, ""));
  return m ? `+55 (${m[1] ?? ""}) ${m[2] ?? ""}-${m[3] ?? ""}` : phone;
}
