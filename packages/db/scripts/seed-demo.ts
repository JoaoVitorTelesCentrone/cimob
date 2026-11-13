// Uso: pnpm db:seed (cria a demonstração) · pnpm db:seed -- --remove (remove só a demonstração).
import postgres from "postgres";
import { removeDemo, seedDemo } from "../src/demo.ts";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:64322/postgres";
const sql = postgres(url, { max: 1, onnotice: () => undefined });
try {
  if (process.argv.includes("--remove")) {
    await removeDemo(sql);
    console.log("Demonstração removida.");
  } else {
    await seedDemo(sql);
    console.log("Demonstração pronta (todas as linhas com is_demo = true).");
  }
} finally {
  await sql.end();
}
