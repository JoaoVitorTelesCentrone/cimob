import { randomUUID } from "node:crypto";
import postgres from "postgres";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:64322/postgres";

/**
 * Dados de teste com commit de verdade (o worker usa as próprias transações e o cenário de
 * concorrência precisa de duas conexões). Tudo fica numa imobiliária de teste, apagada no fim.
 */
export class BotTestDb {
  readonly sql = postgres(DATABASE_URL, { max: 4, onnotice: () => undefined });
  /** Sufixo desta rodada: wa_message_id é único no banco inteiro, então cada teste usa ids próprios. */
  private readonly run = randomUUID().slice(0, 8);
  private readonly orgs = new Map<string, string>();

  async org(name: string, phoneNumberId: string): Promise<string> {
    const id = randomUUID();
    await this.sql`insert into organizations (id, name, slug, is_demo)
                   values (${id}, ${name}, ${`bot-test-${id.slice(0, 8)}`}, true)`;
    await this.sql`insert into whatsapp_accounts (organization_id, phone_number_id)
                   values (${id}, ${`${phoneNumberId}-${id.slice(0, 8)}`})`;
    this.orgs.set(name, id);
    return id;
  }

  wamid(id: string): string {
    return `${id}.${this.run}`;
  }

  orgId(name: string): string {
    const id = this.orgs.get(name);
    if (!id) throw new Error(`imobiliária desconhecida: ${name}`);
    return id;
  }

  /** Os phone_number_id são únicos no banco inteiro: o teste usa um sufixo por imobiliária. */
  async phoneNumberId(label: string): Promise<string> {
    const ids = [...this.orgs.values()];
    const rows = await this.sql<{ phone_number_id: string }[]>`
      select phone_number_id from whatsapp_accounts
      where organization_id = any(${ids}) and phone_number_id like ${`${label}-%`}`;
    return rows[0]?.phone_number_id ?? `${label}-nenhum`;
  }

  async lead(org: string, name: string, phone: string): Promise<string> {
    const id = randomUUID();
    await this.sql`insert into leads (id, organization_id, name, phone, is_demo)
                   values (${id}, ${this.orgId(org)}, ${name}, ${phone}, true)`;
    return id;
  }

  private readonly users: string[] = [];
  private readonly secrets: string[] = [];

  /** Guarda o token da Cloud API no Vault e liga ao número da imobiliária. */
  async vaultToken(org: string, token: string): Promise<void> {
    const [row] = await this.sql<{ id: string }[]>`
      select vault.create_secret(${token}, ${`wa-token-${randomUUID()}`}) as id`;
    if (!row) throw new Error("segredo não criado");
    this.secrets.push(row.id);
    await this.sql`update whatsapp_accounts set token_secret_id = ${row.id}
                   where organization_id = ${this.orgId(org)}`;
  }

  /** Conta de anúncios da imobiliária na Marketing API. */
  async metaAdsAccount(org: string, adAccountId: string): Promise<void> {
    await this.sql`insert into meta_ads_accounts (organization_id, ad_account_id)
                   values (${this.orgId(org)}, ${adAccountId})`;
  }

  /** Guarda o token da Marketing API no Vault e liga à conta de anúncios da imobiliária. */
  async vaultAdsToken(org: string, token: string): Promise<void> {
    const [row] = await this.sql<{ id: string }[]>`
      select vault.create_secret(${token}, ${`ads-token-${randomUUID()}`}) as id`;
    if (!row) throw new Error("segredo não criado");
    this.secrets.push(row.id);
    await this.sql`update meta_ads_accounts set token_secret_id = ${row.id}
                   where organization_id = ${this.orgId(org)}`;
  }

  /** Número da imobiliária no banco (qualquer que seja o rótulo usado na criação). */
  async phoneOf(org: string): Promise<string> {
    const [row] = await this.sql<{ phone_number_id: string }[]>`
      select phone_number_id from whatsapp_accounts where organization_id = ${this.orgId(org)}`;
    if (!row) throw new Error(`sem número para ${org}`);
    return row.phone_number_id;
  }

  async adSpend(org: string) {
    return this.sql<
      {
        date: string;
        ad_id: string;
        campaign_id: string | null;
        spend: string;
        impressions: number;
        clicks: number;
      }[]
    >`
      select date::text, ad_id, campaign_id, spend::text, impressions, clicks
      from ad_spend_daily
      where organization_id = ${this.orgId(org)}
      order by date desc, ad_id`;
  }

  async adSpendCount(): Promise<number> {
    const ids = [...this.orgs.values()];
    const [row] = await this.sql<{ n: number }[]>`
      select count(*)::int as n from ad_spend_daily where organization_id = any(${ids})`;
    return row?.n ?? 0;
  }

  async adsAccounts() {
    const ids = [...this.orgs.values()];
    return this.sql<{ organization_id: string; ad_account_id: string }[]>`
      select organization_id, ad_account_id from meta_ads_accounts
      where organization_id = any(${ids})`;
  }

  async removeToken(org: string): Promise<void> {
    await this.sql`update whatsapp_accounts set token_secret_id = null
                   where organization_id = ${this.orgId(org)}`;
  }

  async conversationId(org: string, contact: string): Promise<string> {
    const row = await this.conversation(org, contact);
    if (!row) throw new Error(`sem conversa com ${contact}`);
    return row.id;
  }

  async sendStates(org: string, contact: string) {
    return this.sql<
      { send_status: string; wa_message_id: string | null; send_error: string | null }[]
    >`
      select m.send_status::text, m.wa_message_id, m.send_error from messages m
      join conversations c on c.id = m.conversation_id
      where c.organization_id = ${this.orgId(org)} and c.wa_contact = ${contact}
        and m.direction = 'outbound'
      order by m.created_at`;
  }
  private developmentId: string | null = null;

  readonly agents = new Map<string, string>();

  async setWhatsapp(org: string, name: string, whatsapp: string | null): Promise<void> {
    await this.sql`update memberships set whatsapp = ${whatsapp}
                   where organization_id = ${this.orgId(org)} and user_id = ${this.agents.get(name) ?? ""}`;
  }

  /** Corretor ativo no rodízio (usuário no Auth + membership com o nome exibido). */
  async agent(org: string, name: string, inRotation = true): Promise<string> {
    const id = randomUUID();
    this.users.push(id);
    this.agents.set(name, id);
    await this
      .sql`insert into auth.users (id, email) values (${id}, ${`bot-${id.slice(0, 8)}@test.local`})`;
    await this
      .sql`insert into memberships (organization_id, user_id, role, display_name, in_rotation)
                   values (${this.orgId(org)}, ${id}, 'agent', ${name}, ${inRotation})`;
    return id;
  }

  async unit(org: string, code: string, price: number | null, status: string): Promise<void> {
    if (!this.developmentId) {
      this.developmentId = randomUUID();
      await this.sql`insert into developments (id, organization_id, name, is_demo)
                     values (${this.developmentId}, ${this.orgId(org)}, 'Residencial Aurora', true)`;
    }
    await this.sql`insert into units (organization_id, development_id, code, price, status, is_demo)
                   values (${this.orgId(org)}, ${this.developmentId}, ${code}, ${price},
                           ${status}::unit_status, true)`;
  }

  /** Preenche a ficha da unidade (área, quartos, vagas); nulo deixa o campo vazio. */
  async unitFacts(
    org: string,
    code: string,
    facts: { areaM2: number | null; bedrooms: number | null; parking: number | null },
  ): Promise<void> {
    await this.sql`update units set area_m2 = ${facts.areaM2}, bedrooms = ${facts.bedrooms},
                     parking = ${facts.parking}
                   where organization_id = ${this.orgId(org)} and code = ${code}`;
  }

  /** Mensagem que o bot já mandou (aceita pela Meta), com o wamid devolvido no envio. */
  async sentMessage(org: string, contact: string, waMessageId: string): Promise<void> {
    const [conv] = await this.sql<{ id: string }[]>`
      insert into conversations (organization_id, wa_contact, is_demo)
      values (${this.orgId(org)}, ${contact}, true) returning id`;
    await this.sql`insert into messages (organization_id, conversation_id, wa_message_id, direction,
                     type, body, send_status, sent_at, is_demo)
                   values (${this.orgId(org)}, ${conv?.id ?? ""}, ${waMessageId}, 'outbound',
                     'text', 'Oi', 'sent', now(), true)`;
  }

  async deliveryOf(waMessageId: string) {
    const [row] = await this.sql<
      {
        delivered: boolean;
        read: boolean;
        send_status: string;
        send_error: string | null;
      }[]
    >`
      select delivered_at is not null as delivered, read_at is not null as read,
             send_status::text, send_error
      from messages where wa_message_id = ${waMessageId}`;
    return row;
  }

  async leadByPhone(org: string, phone: string) {
    const [row] = await this.sql<
      {
        id: string;
        name: string | null;
        stage: string;
        qualified: boolean | null;
        source: string | null;
        ad_id: string | null;
        owner_name: string | null;
        unit_code: string | null;
        intent: string | null;
        budget_range: string | null;
        timeframe: string | null;
        wants_visit: boolean | null;
      }[]
    >`
      select l.id, l.name, l.stage::text, l.qualified, l.source, l.ad_id, m.display_name as owner_name,
             u.code as unit_code, l.intent, l.budget_range, l.timeframe, l.wants_visit
      from leads l
      left join memberships m on m.user_id = l.owner_id and m.organization_id = l.organization_id
      left join units u on u.id = l.unit_id
      where l.organization_id = ${this.orgId(org)} and l.phone = ${phone}`;
    return row ?? null;
  }

  async events(leadId: string) {
    return this.sql<{ type: string; data: Record<string, unknown> }[]>`
      select type, data from lead_events where lead_id = ${leadId} order by created_at, type`;
  }

  async consents(org: string, contact: string) {
    return this.sql<{ scope: string; text_shown: string }[]>`
      select k.scope, k.text_shown from consents k
      join conversations c on c.id = k.conversation_id
      where c.organization_id = ${this.orgId(org)} and c.wa_contact = ${contact}`;
  }

  /** Mensagens que o bot deixou para enviar a um contato, em ordem. */
  async outbound(org: string, contact: string) {
    return this.sql<{ type: string; body: string | null; payload: Record<string, unknown> }[]>`
      select m.type, m.body, m.payload from messages m
      join conversations c on c.id = m.conversation_id
      where c.organization_id = ${this.orgId(org)} and c.wa_contact = ${contact}
        and m.direction = 'outbound'
      order by m.created_at`;
  }

  async messages(org: string, contact: string) {
    return this.sql<{ type: string; body: string | null; direction: string }[]>`
      select m.type, m.body, m.direction::text from messages m
      join conversations c on c.id = m.conversation_id
      where c.organization_id = ${this.orgId(org)} and c.wa_contact = ${contact}
      order by m.created_at`;
  }

  async conversation(org: string, contact: string) {
    const [row] = await this.sql<{ id: string; lead_id: string | null }[]>`
      select id, lead_id from conversations
      where organization_id = ${this.orgId(org)} and wa_contact = ${contact}`;
    return row ?? null;
  }

  async countMessages(): Promise<number> {
    const ids = [...this.orgs.values()];
    const [row] = await this.sql<{ n: number }[]>`
      select count(*)::int as n from messages where organization_id = any(${ids})`;
    return row?.n ?? 0;
  }

  async cleanup(): Promise<void> {
    const ids = [...this.orgs.values()];
    if (ids.length) await this.sql`delete from organizations where id = any(${ids})`;
    if (this.users.length) await this.sql`delete from auth.users where id = any(${this.users})`;
    if (this.secrets.length)
      await this.sql`delete from vault.secrets where id = any(${this.secrets})`;
    await this.sql.end();
  }
}
