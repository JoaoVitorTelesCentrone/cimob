export const MENU = [
  { href: "/app", label: "Painel" },
  { href: "/app/funil", label: "Funil" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/imoveis", label: "Imóveis" },
  { href: "/app/equipe", label: "Equipe" },
  { href: "/app/config", label: "Configurações" },
] as const;

export const SECTIONS: Record<string, string> = Object.fromEntries(
  MENU.filter((m) => m.href !== "/app").map((m) => [m.href.replace("/app/", ""), m.label]),
);
