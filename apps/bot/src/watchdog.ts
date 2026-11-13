import type { Queue } from "bullmq";

/** Estado de uma fila: quando chegou a mensagem mais antiga ainda não processada e quantas falharam. */
export type QueueStats = { oldestWaitingAt: number | null; failed: number };
export type QueueProbe = { name: string; stats: () => Promise<QueueStats> };

/** Doc 02: webhook não processado em 60 s é alerta. */
export const MAX_WAIT_MS = 60_000;

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * Vigia das filas (doc 02). A cada conferência: mensagem esperando mais de 60 s, falha nova ou Redis
 * fora do ar viram alerta. Problema que continua não repete; a volta ao normal é avisada. Na 1ª
 * conferência as falhas que já existiam só são anotadas (reiniciar o bot não alerta de novo).
 */
export function createWatchdog(deps: {
  probes: QueueProbe[];
  alert: (text: string) => Promise<void>;
  maxWaitMs?: number;
}) {
  const maxWait = deps.maxWaitMs ?? MAX_WAIT_MS;
  const failedSeen = new Map<string, number>();
  const stuck = new Set<string>();
  let redisDown = false;

  return {
    async check(now: number): Promise<void> {
      let all: { name: string; stats: QueueStats }[];
      try {
        all = await Promise.all(deps.probes.map(async (p) => ({ name: p.name, stats: await p.stats() })));
      } catch {
        if (!redisDown) await deps.alert("Redis fora do ar: o bot não consegue ler as filas");
        redisDown = true;
        return;
      }
      if (redisDown) await deps.alert("Redis de volta: filas legíveis");
      redisDown = false;

      for (const { name, stats } of all) {
        const waitMs = stats.oldestWaitingAt === null ? 0 : now - stats.oldestWaitingAt;
        if (waitMs > maxWait && !stuck.has(name)) {
          stuck.add(name);
          await deps.alert(
            `Fila ${name} parada: mensagem esperando há ${String(Math.round(waitMs / 1000))} s`,
          );
        } else if (waitMs <= maxWait && stuck.delete(name)) {
          await deps.alert(`Fila ${name} normalizada`);
        }

        const before = failedSeen.get(name);
        failedSeen.set(name, stats.failed);
        if (before !== undefined && stats.failed > before) {
          const fresh = stats.failed - before;
          await deps.alert(
            `Fila ${name}: ${plural(fresh, "falha nova", "falhas novas")} (${String(stats.failed)} no total)`,
          );
        }
      }
    },
  };
}

/**
 * Sonda real de uma fila BullMQ. "Esperando" inclui as que aguardam nova tentativa (delayed):
 * do ponto de vista do contato, a mensagem ainda não foi atendida.
 */
export function bullProbe(name: string, queue: Queue): QueueProbe {
  return {
    name,
    async stats() {
      const [oldest, counts] = await Promise.all([
        queue.getJobs(["waiting", "prioritized", "delayed"], 0, 49, true),
        queue.getJobCounts("failed"),
      ]);
      const times = oldest.map((j) => j.timestamp).filter((t) => Number.isFinite(t));
      return {
        oldestWaitingAt: times.length > 0 ? Math.min(...times) : null,
        failed: counts["failed"] ?? 0,
      };
    },
  };
}
