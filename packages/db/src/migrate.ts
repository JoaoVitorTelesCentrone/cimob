import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/** Chave arbitrária do advisory lock das migrações (a mesma em todos os processos). */
const MIGRATION_LOCK = 7_061_311;

/**
 * Aplica as migrações do Drizzle. Usado pelo setup dos testes de mais de um pacote, que o Turbo
 * roda em paralelo: o advisory lock faz o segundo esperar o primeiro em vez de aplicar junto.
 */
export async function migrateDatabase(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await sql`select pg_advisory_lock(${MIGRATION_LOCK})`;
    await migrate(drizzle(sql), {
      migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
    });
  } finally {
    await sql`select pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => undefined);
    await sql.end();
  }
}
