"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { connectRealtime, createRefreshScheduler, type RealtimeTable } from "@/lib/realtime";
import { createBrowserSupabase } from "@/lib/supabase/client";

/**
 * Escuta mudanças da organização no Supabase Realtime e recarrega os dados do servidor.
 * O RLS vale no Realtime: só chegam eventos de linhas que o usuário pode ler.
 */
export function RealtimeRefresh({
  organizationId,
  tables,
}: {
  organizationId: string;
  tables: readonly RealtimeTable[];
}) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    const scheduler = createRefreshScheduler(() => {
      router.refresh();
    });
    const stop = connectRealtime(createBrowserSupabase(), {
      organizationId,
      tables: key.split(",") as RealtimeTable[],
      onChange: () => {
        scheduler.notify();
      },
    });
    return () => {
      scheduler.cancel();
      stop();
    };
  }, [organizationId, key, router]);

  return null;
}
