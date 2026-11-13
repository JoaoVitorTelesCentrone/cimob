// Só para desenvolvimento local: equipe, leads e gasto de anúncios fictícios na demonstração,
// para ver o CRM cheio. Tudo na organização demo (is_demo = true); usuários em @demo.c1imob.local.
//
// Uso: pnpm db:seed:dev (cria/recria) · pnpm db:seed:dev -- --remove (remove).
// Precisa de SUPABASE_SERVICE_ROLE_KEY (de `npx supabase status -o env`) para criar os usuários.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { DEMO_SLUG, seedDemo } from "../src/demo.ts";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:64322/postgres";
const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:64321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL_DOMAIN = "demo.c1imob.local";
const PHONE_PREFIX = "55119888";
const ENV_FILE = resolve(import.meta.dirname, "../../../apps/web/.env.local");

const local = (u: string) => /@(127\.0\.0\.1|localhost)[:/]/.test(u);
if (!local(DATABASE_URL) || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(API_URL)) {
  throw new Error("seed-dev-crm só roda contra o Supabase local.");
}

const TEAM = [
  { key: "paula", name: "Paula Andrade", role: "org_admin", rotation: false },
  { key: "marina", name: "Marina Costa", role: "agent", rotation: true },
  { key: "rafael", name: "Rafael Souza", role: "agent", rotation: true },
  { key: "julia", name: "Júlia Mendes", role: "agent", rotation: true },
] as const;

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Érica", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Patrícia", "Renato", "Sabrina", "Thiago", "Vanessa", "Wagner"];
const LAST = ["Ribeiro", "Lima", "Souza", "Alves", "Nunes", "Prado", "Martins", "Rocha", "Carvalho", "Teixeira", "Barbosa", "Pereira"];
const STAGES = ["new", "qualified", "contacted", "visit_scheduled", "visit_done", "proposal", "won", "lost"] as const;
const STAGE_WEIGHTS = [9, 7, 7, 5, 4, 3, 2, 3];
const SOURCES = ["meta_ads", "meta_ads", "meta_ads", "site", "site", "Indicação"];
const INTENTS = ["morar", "investir"];
const BUDGETS = ["até 500 mil", "500 a 800 mil", "800 mil a 1,2 mi", "acima de 1,2 mi"];
const TIMEFRAMES = ["até 3 meses", "3 a 6 meses", "6 a 12 meses", "sem pressa"];
const LOST = ["Comprou com outra imobiliária", "Sem crédito aprovado", "Desistiu da região", "Parou de responder"];
const ADS = [
  { ad: "ad_demo_aurora_fachada", campaign: "camp_demo_aurora" },
  { ad: "ad_demo_aurora_decorado", campaign: "camp_demo_aurora" },
  { ad: "ad_demo_aurora_planta", campaign: "camp_demo_aurora" },
];

/** Gerador determinístico: os mesmos dados a cada rodada. */
let seed = 42;
const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
const weighted = <T>(xs: readonly T[], w: readonly number[]): T => {
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) if ((r -= w[i] ?? 0) < 0) return xs[i] as T;
  return xs[xs.length - 1] as T;
};
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function admin(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
    },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Auth admin ${path}: HTTP ${String(res.status)}`);
  return body;
}

async function demoUsers(): Promise<{ id: string; email: string }[]> {
  const body = (await admin("/users?per_page=1000")) as { users: { id: string; email: string }[] };
  return body.users.filter((u) => u.email.endsWith(`@${EMAIL_DOMAIN}`));
}

async function remove(sql: postgres.Sql) {
  const users = await demoUsers();
  if (users.length > 0) await sql`delete from platform_admins where user_id = any(${users.map((u) => u.id)})`;
  for (const u of users) await admin(`/users/${u.id}`, { method: "DELETE" });
  await sql`delete from leads where phone like ${`${PHONE_PREFIX}%`} and is_demo`;
  await sql`delete from ad_spend_daily where ad_id like 'ad_demo_%' and is_demo`;
}

/** Grava (ou troca) uma variável no .env.local do web, sem mexer nas outras. */
function setEnv(lines: Record<string, string>) {
  let text = "";
  try {
    text = readFileSync(ENV_FILE, "utf8");
  } catch {
    // arquivo novo
  }
  for (const [k, v] of Object.entries(lines)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.trimEnd()}\n${k}=${v}\n`;
  }
  writeFileSync(ENV_FILE, text);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
try {
  if (!SERVICE_KEY) throw new Error("defina SUPABASE_SERVICE_ROLE_KEY (npx supabase status -o env)");
  await remove(sql);
  if (process.argv.includes("--remove")) {
    console.log("Dados fictícios do CRM removidos.");
  } else {
    await seedDemo(sql);
    const [org] = await sql<{ id: string }[]>`select id from organizations where slug = ${DEMO_SLUG}`;
    if (!org) throw new Error("organização demo não encontrada");

    // Equipe: usuários no Auth (com senha, para a entrada automática) e memberships.
    const password = randomBytes(18).toString("base64url");
    const ids = new Map<string, string>();
    for (const m of TEAM) {
      const user = (await admin("/users", {
        method: "POST",
        body: JSON.stringify({ email: `${m.key}@${EMAIL_DOMAIN}`, password, email_confirm: true }),
      })) as { id: string };
      ids.set(m.key, user.id);
      await sql`
        insert into memberships (organization_id, user_id, role, display_name, in_rotation, whatsapp)
        values (${org.id}, ${user.id}, ${m.role}::membership_role, ${m.name}, ${m.rotation},
                ${m.role === "agent" ? `55119777${String(ids.size).padStart(5, "0")}` : null})`;
    }
    // Center One: admin da plataforma (tela Agência e parte técnica), como agência na demo.
    const carlos = (await admin("/users", {
      method: "POST",
      body: JSON.stringify({ email: `carlos@${EMAIL_DOMAIN}`, password, email_confirm: true }),
    })) as { id: string };
    await sql`insert into platform_admins (user_id) values (${carlos.id})`;
    await sql`insert into memberships (organization_id, user_id, role, display_name)
               values (${org.id}, ${carlos.id}, 'agency_admin', 'Carlos (Center One)')`;

    const agents = TEAM.filter((m) => m.role === "agent").map((m) => ids.get(m.key) ?? "");

    // Leads: últimos 45 dias, funil completo, alguns atrasados (atribuídos há mais de 2 h sem resposta).
    const now = Date.now();
    const units = await sql<{ id: string }[]>`select id from units where organization_id = ${org.id}`;
    for (let i = 0; i < 48; i++) {
      const stage = weighted(STAGES, STAGE_WEIGHTS);
      const createdAt = new Date(now - Math.floor(rand() ** 1.4 * 45 * DAY) - HOUR);
      const owner = stage === "new" && rand() < 0.35 ? null : pick(agents);
      const assignedAt = owner ? new Date(createdAt.getTime() + Math.floor(rand() * 20) * 60_000) : null;
      const late = owner && assignedAt && (stage === "new" || stage === "qualified") && rand() < 0.4;
      const firstResponseAt =
        assignedAt && !late ? new Date(assignedAt.getTime() + Math.floor(3 + rand() * 90) * 60_000) : null;
      const source = pick(SOURCES);
      const qualified = stage !== "new" || rand() < 0.3;
      await sql`
        insert into leads (organization_id, name, phone, source, ad_id, campaign_id, unit_id, intent,
                           budget_range, timeframe, wants_visit, qualified, stage, owner_id,
                           assigned_at, first_response_at, visit_at, lost_reason, is_demo, created_at)
        values (${org.id}, ${`${pick(FIRST)} ${pick(LAST)}`},
                ${`${PHONE_PREFIX}${String(i + 1).padStart(5, "0")}`}, ${source},
                ${source === "meta_ads" ? pick(ADS).ad : null},
                ${source === "meta_ads" ? "camp_demo_aurora" : null},
                ${rand() < 0.6 ? (pick(units)?.id ?? null) : null},
                ${qualified ? pick(INTENTS) : null}, ${qualified ? pick(BUDGETS) : null},
                ${qualified ? pick(TIMEFRAMES) : null}, ${qualified ? rand() < 0.6 : null},
                ${qualified}, ${stage}::lead_stage, ${owner}, ${assignedAt}, ${firstResponseAt},
                ${stage === "visit_scheduled" ? new Date(now + Math.floor(1 + rand() * 6) * DAY) : stage === "visit_done" ? new Date(createdAt.getTime() + 3 * DAY) : null},
                ${stage === "lost" ? pick(LOST) : null}, true, ${createdAt})`;
    }

    // Gasto da Meta: 45 dias, três anúncios do Aurora.
    for (let d = 0; d < 45; d++) {
      const date = new Date(now - d * DAY - 3 * HOUR).toISOString().slice(0, 10);
      for (const a of ADS) {
        const spend = Math.round((25 + rand() * 55) * 100) / 100;
        const impressions = Math.floor(spend * (35 + rand() * 20));
        await sql`
          insert into ad_spend_daily (organization_id, date, ad_id, campaign_id, spend, impressions, clicks, is_demo)
          values (${org.id}, ${date}, ${a.ad}, ${a.campaign}, ${spend}, ${impressions},
                  ${Math.floor(impressions * (0.01 + rand() * 0.02))}, true)
          on conflict (organization_id, date, ad_id) do nothing`;
      }
    }

    setEnv({
      DEV_AUTO_LOGIN_EMAIL: `paula@${EMAIL_DOMAIN}`,
      DEV_AUTO_LOGIN_PASSWORD: password,
    });
    console.log(
      `CRM de demonstração pronto: ${String(TEAM.length)} pessoas, 48 leads e 45 dias de gasto (is_demo). ` +
        "Entrada automática como Paula (gestora) gravada em apps/web/.env.local.",
    );
  }
} finally {
  await sql.end();
}
