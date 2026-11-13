export const REFRESH_DELAY_MS = 400;

/**
 * Junta rajadas de mudanças (ex.: arrastar vários cards, importar unidades) num recarregamento só:
 * recarrega quando passa `delayMs` sem mudança nova.
 */
export function createRefreshScheduler(refresh: () => void, delayMs = REFRESH_DELAY_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    notify() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, delayMs);
    },
    cancel,
  };
}

export type RealtimeTable = "leads" | "lead_events" | "units" | "properties";

/** Assinaturas do Realtime, sempre filtradas pela organização (o RLS também vale no Realtime). */
export function realtimeSubscriptions(organizationId: string, tables: readonly RealtimeTable[]) {
  return tables.map((table) => ({ table, filter: `organization_id=eq.${organizationId}` }));
}

type Session = { access_token: string } | null;
type ChannelLike = {
  on(
    type: "postgres_changes",
    filter: { event: "*"; schema: "public"; table: string; filter: string },
    callback: () => void,
  ): ChannelLike;
  subscribe(): unknown;
};

/** O pedaço do client do Supabase que o Realtime usa (permite testar sem rede). */
export type RealtimeClientLike = {
  auth: {
    getSession(): Promise<{ data: { session: Session } }>;
    onAuthStateChange(cb: (event: string, session: Session) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
  };
  realtime: { setAuth(token: string | null): Promise<void> | void };
  channel(name: string): ChannelLike;
  removeChannel(channel: ChannelLike): Promise<unknown>;
};

/**
 * Assina as mudanças da organização com o token do usuário.
 * Sem o token o Realtime trata a conexão como anônima e o RLS recusa a assinatura,
 * então o token vai antes do subscribe e é repassado a cada renovação.
 * Devolve a função que para de escutar.
 */
export function connectRealtime(
  client: RealtimeClientLike,
  opts: { organizationId: string; tables: readonly RealtimeTable[]; onChange: () => void },
): () => void {
  // Lido por função: o lint não enxerga que o retorno muda o valor durante os `await` e acusaria "sempre falso".
  let stopped = false;
  const isStopped = () => stopped;
  let channel: ChannelLike | null = null;

  const auth = client.auth.onAuthStateChange((_event, session) => {
    void client.realtime.setAuth(session?.access_token ?? null);
  });

  void (async () => {
    const { data } = await client.auth.getSession();
    if (isStopped()) return;
    await client.realtime.setAuth(data.session?.access_token ?? null);
    if (isStopped()) return;
    const ch = client.channel(`crm:${opts.organizationId}:${opts.tables.join(",")}`);
    for (const sub of realtimeSubscriptions(opts.organizationId, opts.tables)) {
      ch.on("postgres_changes", { event: "*", schema: "public", ...sub }, opts.onChange);
    }
    ch.subscribe();
    channel = ch;
  })();

  return () => {
    stopped = true;
    auth.data.subscription.unsubscribe();
    if (channel) void client.removeChannel(channel);
  };
}
