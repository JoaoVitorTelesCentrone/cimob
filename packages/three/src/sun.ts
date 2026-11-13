import SunCalc from "suncalc";

export type Location = { lat: number; lng: number };
export type Vec3 = [number, number, number];

export type Sun = {
  /** Posição da luz do sol na cena (norte = -z, leste = +x, frente do prédio = +z). */
  position: Vec3;
  /** Altura do sol acima do horizonte, em radianos. */
  altitude: number;
  night: boolean;
  /** Intensidade da luz direcional (0 à noite). */
  intensity: number;
  /** Há localização na ficha, então a hora pode ser escolhida. */
  controllable: boolean;
};

const DISTANCE = 100;

/** Sem lat/lng na ficha não há sol "de verdade": luz fixa de dia, sem controle de hora. */
export const DEFAULT_SUN: Sun = {
  position: [80, 60, 40],
  altitude: Math.atan2(60, Math.hypot(80, 40)),
  night: false,
  intensity: 2.2,
  controllable: false,
};

/**
 * Sol pela localização e pela data (suncalc). O azimute do suncalc começa no sul e cresce para
 * oeste; na cena o sul é +z e o oeste é -x.
 */
export function sunAt(location: Location | null, date: Date): Sun {
  if (!location) return DEFAULT_SUN;
  const { altitude, azimuth } = SunCalc.getPosition(date, location.lat, location.lng);
  const ground = Math.cos(altitude) * DISTANCE;
  const night = altitude <= 0;
  return {
    position: [
      -Math.sin(azimuth) * ground,
      Math.sin(altitude) * DISTANCE,
      Math.cos(azimuth) * ground,
    ],
    altitude,
    night,
    intensity: night ? 0 : Math.min(2.4, 0.5 + 2.2 * Math.sin(altitude)),
    controllable: true,
  };
}

/**
 * Data da hora escolhida no controle, na hora de Brasília (sem horário de verão desde 2019).
 * Hora fracionada vira minutos (13,5 → 13h30).
 */
export function dateAtHour(day: string, hour: number): Date {
  const h = Math.max(0, Math.min(23.99, hour));
  const minutes = Math.round(h * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${day}T${hh}:${mm}:00-03:00`);
}

/** Dia (AAAA-MM-DD) e hora atuais em Brasília: o valor inicial do controle de hora. */
export function brasiliaNow(now: Date): { day: string; hour: number } {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return {
    day: local.toISOString().slice(0, 10),
    hour: local.getUTCHours() + local.getUTCMinutes() / 60,
  };
}
