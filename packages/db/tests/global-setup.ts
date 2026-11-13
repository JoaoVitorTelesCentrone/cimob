import { migrateDatabase } from "../src/migrate.js";
import { DATABASE_URL } from "./helpers.js";

/** Aplica as migrações no Supabase local antes dos testes. Exige `pnpm db:start`. */
export default async function setup(): Promise<void> {
  try {
    await migrateDatabase(DATABASE_URL);
  } catch (e) {
    throw new Error(
      `Não foi possível migrar o banco em ${DATABASE_URL}. O Supabase local está rodando (pnpm db:start)? ${String(e)}`,
    );
  }
}
