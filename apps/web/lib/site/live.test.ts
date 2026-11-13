import { describe, expect, it } from "vitest";
import { applyUnitChange, connectLiveUnits, type LiveClientLike } from "./live";
import type { SiteUnit } from "./model";

const units: SiteUnit[] = [
  { code: "A-1", bedrooms: null, areaM2: null, price: null, status: "available" },
  { code: "A-2", bedrooms: null, areaM2: null, price: null, status: "sold" },
];

describe("applyUnitChange", () => {
  it("troca só o status da unidade do evento", () => {
    const next = applyUnitChange(units, {
      eventType: "UPDATE",
      new: { code: "A-2", status: "reserved" },
    });
    expect(next.map((u) => u.status)).toEqual(["available", "reserved"]);
    expect(next[0]).toBe(units[0]);
  });
  it("sem mudança de fato, devolve a mesma lista (não redesenha)", () => {
    expect(
      applyUnitChange(units, { eventType: "UPDATE", new: { code: "A-1", status: "available" } }),
    ).toBe(units);
  });
  it("ignora evento que não é UPDATE ou que veio malformado", () => {
    expect(applyUnitChange(units, { eventType: "DELETE", old: { code: "A-1" } })).toBe(units);
    expect(applyUnitChange(units, null)).toBe(units);
  });
});

describe("connectLiveUnits", () => {
  it("assina as unidades do empreendimento e para de escutar ao sair", () => {
    const calls: string[] = [];
    let handler: ((p: unknown) => void) | null = null;
    const channel = {
      on(_t: string, filter: { filter: string }, cb: (p: unknown) => void) {
        calls.push(filter.filter);
        handler = cb;
        return channel;
      },
      subscribe() {
        calls.push("subscribe");
      },
    };
    const client = {
      channel: (name: string) => {
        calls.push(name);
        return channel;
      },
      removeChannel: () => {
        calls.push("remove");
        return Promise.resolve();
      },
    } as unknown as LiveClientLike;
    const seen: unknown[] = [];
    const stop = connectLiveUnits(client, {
      developmentId: "dev-1",
      onChange: (p) => seen.push(p),
    });
    (handler as ((p: unknown) => void) | null)?.("evento");
    stop();
    expect(calls).toEqual(["site:units:dev-1", "development_id=eq.dev-1", "subscribe", "remove"]);
    expect(seen).toEqual(["evento"]);
  });
});
