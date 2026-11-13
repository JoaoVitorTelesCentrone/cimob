import { describe, expect, it } from "vitest";
import {
  buildDashboard,
  formatBRL,
  formatMinutes,
  lateAlert,
  median,
  parsePeriod,
  percent,
  type DashboardLead,
} from "./dashboard";
import type { Member } from "./queries";

const now = new Date("2026-11-12T15:00:00-03:00");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let seq = 0;
const lead = (over: Partial<DashboardLead> = {}): DashboardLead => {
  seq += 1;
  return {
    id: `lead-${String(seq)}`,
    name: `Lead ${String(seq)}`,
    phone: "5511900000000",
    stage: "new",
    source: null,
    qualified: null,
    ownerId: null,
    ownerName: null,
    assignedAt: null,
    firstResponseAt: null,
    createdAt: new Date(now.getTime() - HOUR),
    ...over,
  };
};

const members: Member[] = [
  { userId: "u-admin", name: "Gestor", role: "org_admin" },
  { userId: "u-bia", name: "Bia", role: "agent" },
  { userId: "u-ana", name: "Ana", role: "agent" },
];

describe("parsePeriod", () => {
  it("aceita 7 e 30 dias", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("30")).toBe(30);
  });

  it("qualquer outro valor vira 30", () => {
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod("365")).toBe(30);
    expect(parsePeriod("7abc")).toBe(30);
    expect(parsePeriod(["7", "30"])).toBe(7);
  });
});

describe("median", () => {
  it("é nula para lista vazia", () => {
    expect(median([])).toBeNull();
  });

  it("pega o meio da lista ordenada (ou a média dos dois do meio)", () => {
    expect(median([30, 5, 10])).toBe(10);
    expect(median([10, 5])).toBe(7.5);
  });
});

describe("formatMinutes e percent", () => {
  it("arredonda os minutos e usa traço quando não há valor", () => {
    expect(formatMinutes(7.5)).toBe("8 min");
    expect(formatMinutes(null)).toBe("–");
  });

  it("calcula porcentagem inteira sem dividir por zero", () => {
    expect(percent(5, 7)).toBe(71);
    expect(percent(1, 0)).toBe(0);
  });
});

describe("buildDashboard", () => {
  it("só conta leads que chegaram dentro do período", () => {
    const leads = [
      lead({ createdAt: new Date(now.getTime() - 6 * DAY) }),
      lead({ createdAt: new Date(now.getTime() - 8 * DAY) }),
    ];
    expect(buildDashboard(leads, members, 7, now).kpis[0]?.value).toBe("1");
    expect(buildDashboard(leads, members, 30, now).kpis[0]?.value).toBe("2");
  });

  it("qualificado é quem o bot marcou como qualificado ou quem já avançou no funil", () => {
    const leads = [
      lead({ qualified: true }),
      lead({ stage: "contacted" }),
      lead({ stage: "lost", qualified: false }),
      lead({ stage: "new", qualified: false }),
    ];
    const qualified = buildDashboard(leads, members, 30, now).kpis[1];
    expect(qualified).toEqual({ label: "Qualificados", value: "2", detail: "50% dos leads" });
  });

  it("perdido não conta como visita nem proposta", () => {
    const d = buildDashboard([lead({ stage: "lost", qualified: true })], members, 30, now);
    expect(d.funnel.map((s) => s.count)).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });

  it("agrupa por origem, maiores primeiro e 'Sem origem' no fim", () => {
    const leads = [
      lead({ source: "Site" }),
      lead({ source: null }),
      lead({ source: "Anúncio Meta" }),
      lead({ source: "Anúncio Meta" }),
      lead({ source: "Indicação" }),
    ];
    expect(buildDashboard(leads, members, 30, now).bySource.map((s) => s.source)).toEqual([
      "Anúncio Meta",
      "Indicação",
      "Site",
      "Sem origem",
    ]);
  });

  it("traduz as origens conhecidas e mantém as outras como vieram", () => {
    const leads = [
      lead({ source: "meta_ads" }),
      lead({ source: "site" }),
      lead({ source: "Feirão" }),
    ];
    expect(
      buildDashboard(leads, members, 30, now)
        .bySource.map((s) => s.source)
        .sort(),
    ).toEqual(["Anúncio Meta", "Feirão", "Site"]);
  });

  it("por corretor mostra os corretores (mesmo sem leads) e quem tem lead, em ordem de nome", () => {
    const leads = [lead({ ownerId: "u-admin", ownerName: "Gestor" })];
    const d = buildDashboard(leads, members, 30, now);
    expect(d.byAgent.map((a) => [a.name, a.leads])).toEqual([
      ["Ana", 0],
      ["Bia", 0],
      ["Gestor", 1],
    ]);
  });

  it("atrasados por corretor contam fora do período (o atraso é de agora)", () => {
    const old = lead({
      ownerId: "u-ana",
      assignedAt: new Date(now.getTime() - 40 * DAY),
      createdAt: new Date(now.getTime() - 40 * DAY),
    });
    const ana = buildDashboard([old], members, 30, now).byAgent.find((a) => a.name === "Ana");
    expect(ana).toMatchObject({ leads: 0, late: 1 });
  });
});

describe("lateAlert", () => {
  const late = (name: string, hoursAgo: number) =>
    lead({ name, ownerId: "u-ana", assignedAt: new Date(now.getTime() - hoursAgo * HOUR) });

  it("é nulo sem atrasados", () => {
    expect(lateAlert([lead()], now)).toBeNull();
  });

  it("lista os atrasados, quem espera há mais tempo primeiro", () => {
    expect(lateAlert([late("Bia", 3), late("Caio", 5)], now)).toEqual({
      count: 2,
      message: "2 leads sem primeira resposta há mais de 2 h: Caio, Bia",
      href: "/app/leads?late=1",
    });
  });

  it("mostra até 5 nomes e resume o resto", () => {
    const leads = Array.from({ length: 7 }, (_, i) => late(`L${String(i + 1)}`, 3 + i));
    expect(lateAlert(leads, now)?.message).toBe(
      "7 leads sem primeira resposta há mais de 2 h: L7, L6, L5, L4, L3 e mais 2",
    );
  });
});

describe("formatBRL", () => {
  it("formata em reais com centavos e separador de milhar", () => {
    expect(formatBRL(800)).toBe("R$ 800,00");
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
  });

  it("usa traço quando não há valor", () => {
    expect(formatBRL(null)).toBe("–");
  });
});

describe("custo de marketing", () => {
  const day = (iso: string, spend: number) => ({ date: new Date(`${iso}T00:00:00-03:00`), spend });

  it("sem gasto importado não há indicadores nem colunas de custo", () => {
    const d = buildDashboard([lead({ source: "meta_ads" })], members, 30, now);
    expect(d.costKpis).toEqual([]);
    expect(d.bySource[0]).toMatchObject({ investment: null, cpl: null, costPerVisit: null });
  });

  it("conta o gasto dos dias que tocam o período, inclusive o dia em que ele começa", () => {
    // 7 dias antes de 12/11 15:00 = 05/11 15:00; o dia 05/11 ainda entra, o 04/11 não.
    const spend = [day("2026-11-05", 10), day("2026-11-04", 1000), day("2026-11-12", 5)];
    const d = buildDashboard([], members, 7, now, spend);
    expect(d.costKpis[0]).toEqual({
      label: "Investimento",
      value: "R$ 15,00",
      detail: "em anúncios Meta",
    });
  });

  it("CPL e custo por visita usam só os leads de anúncio, no singular quando é um", () => {
    const leads = [
      lead({ source: "meta_ads", stage: "visit_done" }),
      lead({ source: "site", stage: "visit_done" }),
    ];
    const d = buildDashboard(leads, members, 30, now, [day("2026-11-10", 90)]);
    expect(d.costKpis.slice(1)).toEqual([
      { label: "CPL", value: "R$ 90,00", detail: "1 lead de anúncio" },
      { label: "Custo por visita", value: "R$ 90,00", detail: "1 visita de anúncio" },
    ]);
    expect(d.bySource.find((s) => s.source === "Site")).toMatchObject({
      investment: "–",
      cpl: "–",
      costPerVisit: "–",
    });
  });
});
