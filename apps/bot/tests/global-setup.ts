import { migrateDatabase } from "@c1imob/db/migrate";
import { DATABASE_URL } from "./support/db.ts";

/** Os cenários do worker gravam no Postgres local: garante o schema (exige `pnpm db:start`). */
export default async function setup(): Promise<void> {
  try {
    await migrateDatabase(DATABASE_URL);
  } catch (e) {
    throw new Error(
      `Não foi possível migrar o banco em ${DATABASE_URL}. O Supabase local está rodando (pnpm db:start)? ${String(e)}`,
    );
  }
}
