"use client";

import { useEffect, useMemo, useState } from "react";
import { brasiliaNow, dateAtHour, VIEW_NAMES, type ViewRequest } from "@c1imob/three/controls";
import { STATUS_CLASS } from "@/lib/inventory";
import { floorRows } from "@/lib/site/facade";
import { applyUnitChange, connectLiveUnits } from "@/lib/site/live";
import { buildingOf, cardsOf, type DevelopmentView, type SiteUnit } from "@/lib/site/model";
import type { UnitCard } from "@/lib/site/unit-card";
import { browserHasWebgl } from "@/lib/site/webgl";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { SiteBuilding, type BuildingMode } from "./site-building";

const DOT: Record<UnitCard["status"], string> = {
  available: "bg-available",
  reserved: "bg-reserved",
  sold: "bg-sold",
};

/** Andares de cima para baixo, como no espelho de vendas impresso; sem andar fica por último. */
function rowsOf(units: readonly SiteUnit[], cards: readonly UnitCard[]) {
  const byCode = new Map(cards.map((c) => [c.code, c]));
  return floorRows(units).map((row) => ({
    floor: row.floor,
    label: row.label,
    cards: row.units.flatMap((u) => {
      const card = byCode.get(u.code);
      return card ? [card] : [];
    }),
  }));
}

const MIN_HOUR = 5;
const MAX_HOUR = 22;

const hourLabel = (hour: number) => {
  const minutes = Math.round(hour * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${String(h)}h` : `${String(h)}h${String(m).padStart(2, "0")}`;
};

const chip = "inline-flex h-9 items-center rounded-pill border px-3 text-sm font-semibold";
const chipState = (on: boolean) =>
  on ? "border-ink bg-ink text-surface" : "border-line bg-surface-raised text-ink";

function Card({ card }: { card: UnitCard }) {
  return (
    <section
      aria-label={card.title}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[22px] leading-7 font-extrabold uppercase">
          {card.title}
        </h3>
        <span
          className={`rounded-pill px-3 py-1 text-xs font-semibold ${STATUS_CLASS[card.status]}`}
        >
          {card.statusLabel}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2 text-sm">
        {card.facts.map((fact) => (
          <li key={fact} className="rounded-md bg-surface px-3 py-1.5">
            {fact}
          </li>
        ))}
      </ul>
      {card.price && <p className="font-display text-[28px] font-extrabold">{card.price}</p>}
      {card.action && (
        <a
          href={card.action.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-pill bg-brand px-6 text-sm font-semibold text-on-brand"
        >
          {card.action.label}
        </a>
      )}
    </section>
  );
}

/**
 * Espelho de vendas (T3.3–T3.4): o visitante escolhe a unidade no prédio 3D ou na lista e vê o
 * card com os dados da ficha. Vistas prontas, "Só disponíveis" e hora do sol (com localização).
 * O status muda ao vivo pelo Realtime, sem recarregar.
 */
export function UnitPicker({ dev }: { dev: DevelopmentView }) {
  const [units, setUnits] = useState(dev.units);
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [view, setView] = useState<ViewRequest | null>(null);
  // Sem WebGL não há Canvas: o navegador decide depois da hidratação (o servidor não tem DOM).
  const [mode, setMode] = useState<BuildingMode>("unknown");
  // A hora inicial é a de agora: só no navegador, para o HTML do servidor não depender do relógio.
  const [sunTime, setSunTime] = useState<{ day: string; hour: number } | null>(null);

  useEffect(() => {
    setMode(browserHasWebgl() ? "3d" : "2d");
  }, []);

  useEffect(() => {
    const now = brasiliaNow(new Date());
    // No passo e na faixa do controle (5h às 22h), para o rótulo bater com o sol desenhado.
    setSunTime({
      day: now.day,
      hour: Math.min(MAX_HOUR, Math.max(MIN_HOUR, Math.round(now.hour * 4) / 4)),
    });
  }, []);

  useEffect(
    () =>
      connectLiveUnits(createBrowserSupabase(), {
        developmentId: dev.id,
        onChange: (payload) => {
          setUnits((current) => applyUnitChange(current, payload));
        },
      }),
    [dev.id],
  );

  const cards = useMemo(
    () => cardsOf({ name: dev.name, contact: dev.contact, units }),
    [dev.name, dev.contact, units],
  );
  const building = useMemo(() => buildingOf(units), [units]);
  const floors = useMemo(() => rowsOf(units, cards), [units, cards]);
  const card = cards.find((c) => c.code === selected) ?? null;
  const hasBuilding = Boolean(dev.modelUrl) || units.some((u) => (u.floor ?? 0) >= 1);
  const show3d = hasBuilding && mode === "3d";
  const date = dev.location && sunTime ? dateAtHour(sunTime.day, sunTime.hour) : null;

  return (
    <section aria-labelledby="unidades" className="flex flex-col gap-4">
      <h2 id="unidades" className="font-display text-[22px] font-extrabold uppercase">
        Escolha sua unidade
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {show3d && (
          <div role="group" aria-label="Vistas do prédio" className="flex flex-wrap gap-2">
            {VIEW_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={view?.name === name}
                onClick={() => {
                  setView({ name, at: Date.now() });
                }}
                className={`${chip} ${chipState(view?.name === name)}`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-pressed={onlyAvailable}
          onClick={() => {
            setOnlyAvailable((v) => !v);
          }}
          className={`${chip} ${chipState(onlyAvailable)}`}
        >
          <span aria-hidden className={`mr-2 size-2.5 rounded-full ${DOT.available}`} />
          Só disponíveis
        </button>
      </div>
      {hasBuilding && (
        <div className="relative">
          <SiteBuilding
            name={dev.name}
            units={building}
            modelUrl={dev.modelUrl}
            location={dev.location}
            date={date}
            view={view}
            onlyAvailable={onlyAvailable}
            selected={selected}
            mode={mode}
            onSelect={setSelected}
          />
          {show3d && dev.location && sunTime && (
            <label className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-md bg-surface-raised/90 px-3 py-2 text-sm shadow-[var(--shadow-card)] sm:inset-x-auto sm:right-3 sm:w-80">
              <span className="shrink-0 font-semibold">Sol às {hourLabel(sunTime.hour)}</span>
              <input
                type="range"
                min={MIN_HOUR}
                max={MAX_HOUR}
                step={0.25}
                value={sunTime.hour}
                aria-label="Hora do dia"
                aria-valuetext={hourLabel(sunTime.hour)}
                onChange={(e) => {
                  const hour = Number(e.target.value);
                  setSunTime((t) => (t ? { ...t, hour } : t));
                }}
                className="w-full accent-[var(--brand)]"
              />
            </label>
          )}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-[1fr_minmax(280px,360px)]">
        <div role="list" aria-label="Unidades" className="flex flex-col gap-3">
          {floors.map(({ floor, label, cards: list }) => (
            <div key={floor ?? "sem-andar"} role="listitem" className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-ink-muted">{label}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((c) => {
                  const faded = onlyAvailable && c.status !== "available" && c.code !== selected;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={c.code === selected}
                      aria-label={`${c.title}, ${c.statusLabel}`}
                      onClick={() => {
                        setSelected(c.code);
                      }}
                      className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                        c.code === selected
                          ? "border-ink bg-ink text-surface"
                          : "border-line bg-surface-raised"
                      } ${faded ? "opacity-40" : ""}`}
                    >
                      <span aria-hidden className={`size-2.5 rounded-full ${DOT[c.status]}`} />
                      {c.title.replace("Unidade ", "")}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div aria-live="polite">
          {card ? (
            <Card card={card} />
          ) : (
            <p className="rounded-lg border border-dashed border-line p-5 text-sm text-ink-muted">
              Toque numa unidade no prédio ou na lista para ver área, dormitórios e valor.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
