import { z } from "zod";
import { UNIT_STATUSES } from "@/lib/inventory";
import type { SiteUnit } from "./model";

/**
 * Status ao vivo no site (T3.4, doc 05): o Supabase Realtime avisa quando uma unidade do
 * empreendimento muda e o site troca a cor e o card sem recarregar. O visitante é anônimo; o RLS
 * só entrega unidades de empreendimento publicado.
 */

const Change = z.object({
  eventType: z.literal("UPDATE"),
  new: z.object({ code: z.string(), status: z.enum(UNIT_STATUSES) }),
});

/** Aplica um evento do Realtime. Evento de outra unidade, malformado ou sem mudança: mesma lista. */
export function applyUnitChange(units: readonly SiteUnit[], payload: unknown): SiteUnit[] {
  const parsed = Change.safeParse(payload);
  if (!parsed.success) return units as SiteUnit[];
  const { code, status } = parsed.data.new;
  const index = units.findIndex((u) => u.code === code);
  if (index < 0 || units[index]?.status === status) return units as SiteUnit[];
  return units.map((u, i) => (i === index ? { ...u, status } : u));
}

type ChannelLike = {
  on(
    type: "postgres_changes",
    filter: { event: "UPDATE"; schema: "public"; table: "units"; filter: string },
    callback: (payload: unknown) => void,
  ): ChannelLike;
  subscribe(): unknown;
};

/** O pedaço do client do Supabase que o site usa (permite testar sem rede). */
export type LiveClientLike = {
  channel(name: string): ChannelLike;
  removeChannel(channel: ChannelLike): Promise<unknown>;
};

/** Assina as mudanças de unidades do empreendimento. Devolve a função que para de escutar. */
export function connectLiveUnits(
  client: LiveClientLike,
  opts: { developmentId: string; onChange: (payload: unknown) => void },
): () => void {
  const channel = client.channel(`site:units:${opts.developmentId}`).on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "units",
      filter: `development_id=eq.${opts.developmentId}`,
    },
    opts.onChange,
  );
  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
