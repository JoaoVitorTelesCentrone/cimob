import { randomUUID } from "node:crypto";
import postgres from "postgres";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:64322/postgres";

export type Role = "agency_admin" | "org_admin" | "agent";
export type Conn = postgres.ReservedSql;

/** Uma conexão por cenário, dentro de uma transação que sempre termina em rollback. */
export class Scenario {
  readonly orgs = new Map<string, string>();
  readonly users = new Map<string, string>();
  readonly devs = new Map<string, string>();
  readonly units = new Map<string, string>();
  readonly leads = new Map<string, string>();
  readonly props = new Map<string, string>();
  readonly conversations = new Map<string, string>();

  private constructor(
    private readonly sql: postgres.Sql,
    readonly conn: Conn,
  ) {}

  static async begin(): Promise<Scenario> {
    const sql = postgres(DATABASE_URL, { max: 2, onnotice: () => undefined });
    const conn = await sql.reserve();
    await conn`begin`;
    return new Scenario(sql, conn);
  }

  async end(): Promise<void> {
    await this.conn`rollback`;
    this.conn.release();
    await this.sql.end();
  }

  orgId(name: string): string {
    const id = this.orgs.get(name);
    if (!id) throw new Error(`organização desconhecida: ${name}`);
    return id;
  }

  async org(name: string, extra: { slug?: string; customDomain?: string } = {}): Promise<string> {
    const id = randomUUID();
    const slug = extra.slug ?? `${name.toLowerCase()}-${id.slice(0, 8)}`;
    const domain = extra.customDomain ?? null;
    await this
      .conn`insert into organizations (id, name, slug, custom_domain) values (${id}, ${name}, ${slug}, ${domain})`;
    this.orgs.set(name, id);
    return id;
  }

  /** Cria (se preciso) o usuário no Auth e devolve o id. */
  async user(name: string): Promise<string> {
    let userId = this.users.get(name);
    if (!userId) {
      userId = randomUUID();
      const email = `${name.toLowerCase().replace(/\s+/g, "")}-${userId.slice(0, 8)}@test.local`;
      await this.conn`insert into auth.users (id, email) values (${userId}, ${email})`;
      this.users.set(name, userId);
    }
    return userId;
  }

  async member(user: string, org: string, role: Role): Promise<void> {
    const userId = await this.user(user);
    await this
      .conn`insert into memberships (organization_id, user_id, role) values (${this.orgId(org)}, ${userId}, ${role})`;
  }

  async deactivate(user: string, org: string): Promise<void> {
    const userId = this.users.get(user) ?? "";
    await this
      .conn`update memberships set active = false where user_id = ${userId} and organization_id = ${this.orgId(org)}`;
  }

  async development(org: string, name: string, published: boolean): Promise<string> {
    const id = randomUUID();
    await this
      .conn`insert into developments (id, organization_id, name, published) values (${id}, ${this.orgId(org)}, ${name}, ${published})`;
    this.devs.set(name, id);
    return id;
  }

  async unit(org: string, development: string, code: string): Promise<string> {
    const id = randomUUID();
    const dev = this.devs.get(development) ?? "";
    await this
      .conn`insert into units (id, organization_id, development_id, code) values (${id}, ${this.orgId(org)}, ${dev}, ${code})`;
    this.units.set(code, id);
    return id;
  }

  async property(org: string, code: string): Promise<string> {
    const id = randomUUID();
    await this
      .conn`insert into properties (id, organization_id, code, title) values (${id}, ${this.orgId(org)}, ${code}, ${"Imóvel " + code})`;
    this.props.set(code, id);
    return id;
  }

  async lead(org: string, name: string, phone?: string, owner?: string): Promise<string> {
    const id = randomUUID();
    const ownerId = owner ? await this.user(owner) : null;
    const number = phone ?? `55119${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await this
      .conn`insert into leads (id, organization_id, name, phone, owner_id, assigned_at) values (${id}, ${this.orgId(org)}, ${name}, ${number}, ${ownerId}, ${ownerId ? new Date() : null})`;
    this.leads.set(name, id);
    return id;
  }

  async whatsappAccount(org: string, phoneNumberId: string): Promise<void> {
    await this
      .conn`insert into whatsapp_accounts (organization_id, phone_number_id) values (${this.orgId(org)}, ${phoneNumberId})`;
  }

  /** Conversa de um contato (opcionalmente ligada a um lead), com uma mensagem recebida. */
  async conversation(
    org: string,
    key: string,
    opts: { lead?: string; message: string; waMessageId?: string },
  ): Promise<string> {
    const id = randomUUID();
    const leadId = opts.lead ? (this.leads.get(opts.lead) ?? null) : null;
    const contact = `55119${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await this.conn`
      insert into conversations (id, organization_id, lead_id, wa_contact)
      values (${id}, ${this.orgId(org)}, ${leadId}, ${contact})`;
    await this.conn`
      insert into messages (organization_id, conversation_id, wa_message_id, direction, type, body)
      values (${this.orgId(org)}, ${id}, ${opts.waMessageId ?? `wamid.${randomUUID()}`}, 'inbound', 'text', ${opts.message})`;
    this.conversations.set(key, id);
    return id;
  }

  /** Executa `fn` como o usuário autenticado (RLS aplicada), ou como anônimo se `user` for null. */
  async as<T>(user: string | null, fn: (c: Conn) => Promise<T>): Promise<T> {
    const claims = user
      ? JSON.stringify({ sub: this.users.get(user), role: "authenticated" })
      : JSON.stringify({ role: "anon" });
    await this.conn`select set_config('request.jwt.claims', ${claims}, true)`;
    await this.conn.unsafe(`set local role ${user ? "authenticated" : "anon"}`);
    try {
      return await fn(this.conn);
    } finally {
      // Após um erro a transação está abortada; o rollback ao savepoint já desfaz o SET LOCAL ROLE.
      await this.conn.unsafe("reset role").catch(() => undefined);
    }
  }

  /** Tenta uma instrução que deve falhar; devolve a mensagem do erro. Usa savepoint para não abortar a transação. */
  async expectError(fn: (c: Conn) => Promise<unknown>): Promise<string | null> {
    await this.conn`savepoint attempt`;
    try {
      await fn(this.conn);
      await this.conn`release savepoint attempt`;
      return null;
    } catch (e) {
      await this.conn`rollback to savepoint attempt`;
      return e instanceof Error ? e.message : String(e);
    }
  }
}
