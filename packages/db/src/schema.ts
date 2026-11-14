import {
  boolean,
  date,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", ["agency_admin", "org_admin", "agent"]);
export const unitStatus = pgEnum("unit_status", ["available", "reserved", "sold"]);
export const leadStage = pgEnum("lead_stage", [
  "new",
  "qualified",
  "contacted",
  "visit_scheduled",
  "visit_done",
  "proposal",
  "won",
  "lost",
]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const organizationId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  customDomain: text("custom_domain").unique(),
  brand: jsonb("brand").notNull().default({}),
  plan: text("plan").notNull().default("pilot"),
  /** Rodízio: user_id do último corretor que recebeu lead (ver assign_lead_by_rotation). */
  rotationCursor: uuid("rotation_cursor"),
  /** Critério de qualificação (doc 04): prazo máximo ('3m', '6m' ou 'any') e quanto da faixa cobre do preço. */
  qualifyTimeframe: text("qualify_timeframe").notNull().default("6m"),
  qualifyPriceShare: numeric("qualify_price_share", { precision: 3, scale: 2 }).notNull().default("0.90"),
  /** Horário de atendimento { days: 0–6, open: "HH:MM", close: "HH:MM" } em Brasília; nulo = sempre. */
  businessHours: jsonb("business_hours"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
}).enableRLS();

/** Equipe da Center One: cria imobiliárias e cuida da parte técnica (número, anúncios, tokens). */
export const platformAdmins = pgTable("platform_admins", {
  userId: uuid("user_id").primaryKey(),
  createdAt: createdAt(),
}).enableRLS();

/**
 * Convite para entrar numa imobiliária. Vira membership quando a pessoa entra pela 1ª vez com o
 * e-mail convidado (`accept_my_invitations`). E-mail sempre em minúsculas.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    email: text("email").notNull(),
    role: membershipRole("role").notNull(),
    displayName: text("display_name").notNull(),
    whatsapp: text("whatsapp"),
    invitedBy: uuid("invited_by"),
    acceptedBy: uuid("accepted_by"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [unique("invitations_org_email_unique").on(t.organizationId, t.email)],
).enableRLS();

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    userId: uuid("user_id").notNull(),
    role: membershipRole("role").notNull(),
    active: boolean("active").notNull().default(true),
    inRotation: boolean("in_rotation").notNull().default(false),
    /** Nome exibido no CRM (o app não lê auth.users). */
    displayName: text("display_name"),
    /** WhatsApp do corretor (só dígitos, com DDI): recebe o resumo dos leads e responde ao bot. */
    whatsapp: text("whatsapp"),
  },
  (t) => [
    unique("memberships_org_user_unique").on(t.organizationId, t.userId),
    unique("memberships_org_whatsapp_unique").on(t.organizationId, t.whatsapp),
  ],
).enableRLS();

export const developments = pgTable(
  "developments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    modelUrl: text("model_url"),
    deliveryDate: date("delivery_date"),
    /** Só empreendimentos publicados aparecem no site público. */
    published: boolean("published").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  // Permite chaves estrangeiras compostas (organization_id, id): filho e pai sempre na mesma organização.
  (t) => [unique("developments_org_id_unique").on(t.organizationId, t.id)],
).enableRLS();

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    developmentId: uuid("development_id").notNull(),
    code: text("code").notNull(),
    floor: integer("floor"),
    position: text("position"),
    areaM2: numeric("area_m2", { precision: 8, scale: 2 }),
    bedrooms: integer("bedrooms"),
    parking: integer("parking"),
    price: numeric("price", { precision: 14, scale: 2 }),
    status: unitStatus("status").notNull().default("available"),
    /** Nome do objeto no GLB que representa esta unidade. */
    meshName: text("mesh_name"),
    planUrl: text("plan_url"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique("units_org_code_unique").on(t.organizationId, t.code),
    unique("units_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "units_development_fk",
      columns: [t.organizationId, t.developmentId],
      foreignColumns: [developments.organizationId, developments.id],
    }),
  ],
).enableRLS();

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    neighborhood: text("neighborhood"),
    price: numeric("price", { precision: 14, scale: 2 }),
    areaM2: numeric("area_m2", { precision: 8, scale: 2 }),
    bedrooms: integer("bedrooms"),
    status: unitStatus("status").notNull().default("available"),
    fields: jsonb("fields").notNull().default({}),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique("properties_org_code_unique").on(t.organizationId, t.code),
    unique("properties_org_id_unique").on(t.organizationId, t.id),
  ],
).enableRLS();

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name"),
    phone: text("phone").notNull(),
    source: text("source"),
    adId: text("ad_id"),
    campaignId: text("campaign_id"),
    unitId: uuid("unit_id"),
    propertyId: uuid("property_id"),
    intent: text("intent"),
    budgetRange: text("budget_range"),
    timeframe: text("timeframe"),
    wantsVisit: boolean("wants_visit"),
    qualified: boolean("qualified"),
    stage: leadStage("stage").notNull().default("new"),
    /** user_id do corretor dono do lead (memberships.user_id). */
    ownerId: uuid("owner_id"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    visitAt: timestamp("visit_at", { withTimezone: true }),
    /** Próximo passo combinado pelo corretor (texto curto) e quando fazer. */
    nextStep: text("next_step"),
    nextStepAt: timestamp("next_step_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique("leads_org_phone_unique").on(t.organizationId, t.phone),
    unique("leads_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "leads_unit_fk",
      columns: [t.organizationId, t.unitId],
      foreignColumns: [units.organizationId, units.id],
    }),
    foreignKey({
      name: "leads_property_fk",
      columns: [t.organizationId, t.propertyId],
      foreignColumns: [properties.organizationId, properties.id],
    }),
  ],
).enableRLS();

export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    leadId: uuid("lead_id").notNull(),
    type: text("type").notNull(),
    data: jsonb("data").notNull().default({}),
    actorId: uuid("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "lead_events_lead_fk",
      columns: [t.organizationId, t.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
  ],
).enableRLS();

export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
/** Envio das mensagens de saída (as de entrada ficam com nulo). */
export const messageSendStatus = pgEnum("message_send_status", ["pending", "sent", "failed"]);

/** Número do WhatsApp (Cloud API) de cada imobiliária. O webhook resolve a organização por aqui. */
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: organizationId(),
  /** Um número pertence a uma imobiliária só. */
  phoneNumberId: text("phone_number_id").notNull().unique(),
  wabaId: text("waba_id"),
  displayPhone: text("display_phone"),
  /** Id do segredo no Supabase Vault com o token da Cloud API (nunca o token em si). */
  tokenSecretId: uuid("token_secret_id"),
  createdAt: createdAt(),
}).enableRLS();

/** Uma conversa por contato em cada imobiliária. Guarda o estado da máquina do bot. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    leadId: uuid("lead_id"),
    /** wa_id do contato (só dígitos, com DDI). */
    waContact: text("wa_contact").notNull(),
    /** Número da imobiliária com que o contato falou por último: a resposta sai por ele. */
    phoneNumberId: text("phone_number_id"),
    /** Conversa com um corretor da imobiliária (resumos e respostas 1–5), não com um lead. */
    agentUserId: uuid("agent_user_id"),
    state: text("state").notNull().default("new"),
    /** Dados internos do fluxo (respostas não entendidas, motivo da passagem ao corretor...). */
    flowData: jsonb("flow_data").notNull().default({}),
    botPaused: boolean("bot_paused").notNull().default(false),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique("conversations_org_contact_unique").on(t.organizationId, t.waContact),
    unique("conversations_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "conversations_lead_fk",
      columns: [t.organizationId, t.leadId],
      foreignColumns: [leads.organizationId, leads.id],
      // Apagar o lead (LGPD) apaga a conversa e as mensagens dele.
    }).onDelete("cascade"),
  ],
).enableRLS();

/** Mensagens recebidas e enviadas. `wa_message_id` único = idempotência do webhook. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    conversationId: uuid("conversation_id").notNull(),
    waMessageId: text("wa_message_id").unique(),
    direction: messageDirection("direction").notNull(),
    type: text("type").notNull(),
    body: text("body"),
    payload: jsonb("payload").notNull().default({}),
    sendStatus: messageSendStatus("send_status"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Código e mensagem do erro da Meta (nunca o token). */
    sendError: text("send_error"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "messages_conversation_fk",
      columns: [t.organizationId, t.conversationId],
      foreignColumns: [conversations.organizationId, conversations.id],
    }).onDelete("cascade"),
  ],
).enableRLS();

/** Conta de anúncios da Meta (Marketing API) de cada imobiliária. O token fica no Vault. */
export const metaAdsAccounts = pgTable("meta_ads_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: organizationId(),
  /** Uma conta de anúncios pertence a uma imobiliária só. */
  adAccountId: text("ad_account_id").notNull().unique(),
  /** Id do segredo no Supabase Vault com o token da Marketing API (nunca o token em si). */
  tokenSecretId: uuid("token_secret_id"),
  createdAt: createdAt(),
}).enableRLS();

/** Gasto diário por anúncio, importado da Marketing API pelo apps/bot (upsert por org + data + anúncio). */
export const adSpendDaily = pgTable(
  "ad_spend_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    /** Dia do gasto no fuso da conta de anúncios (a Meta agrega por dia). */
    date: date("date").notNull(),
    adId: text("ad_id").notNull(),
    campaignId: text("campaign_id"),
    spend: numeric("spend", { precision: 14, scale: 2 }).notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [unique("ad_spend_daily_org_date_ad_unique").on(t.organizationId, t.date, t.adId)],
).enableRLS();

/**
 * Prova anônima de que um pedido de exclusão (LGPD) foi atendido: quando e quem fez, mais as
 * contagens do que foi apagado. Nunca guarda nome, telefone ou id do lead. Só a função
 * `delete_lead_data` grava; o gestor da própria imobiliária lê.
 */
export const leadDataDeletions = pgTable("lead_data_deletions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: organizationId(),
  actorId: uuid("actor_id"),
  summary: jsonb("summary").notNull().default({}),
  isDemo: boolean("is_demo").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * Importação de tabela de preços em PDF (T4.5): rascunho até o gestor publicar. Só as funções
 * create_unit_import / publish_unit_import / discard_unit_import gravam; o gestor lê.
 */
export const unitImports = pgTable("unit_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: organizationId(),
  developmentId: uuid("development_id").notNull(),
  fileName: text("file_name").notNull(),
  /** draft | published | discarded */
  status: text("status").notNull().default("draft"),
  warnings: jsonb("warnings").notNull().default([]),
  createdBy: uuid("created_by"),
  publishedBy: uuid("published_by"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
}).enableRLS();

/** Linha extraída do PDF. Campo nulo = não deu para ler (não sobrescreve a unidade ao publicar). */
export const unitImportRows = pgTable("unit_import_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: organizationId(),
  importId: uuid("import_id")
    .notNull()
    .references(() => unitImports.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  code: text("code").notNull(),
  floor: integer("floor"),
  areaM2: numeric("area_m2", { precision: 8, scale: 2 }),
  bedrooms: integer("bedrooms"),
  parking: integer("parking"),
  price: numeric("price", { precision: 14, scale: 2 }),
  status: unitStatus("status"),
  needsReview: boolean("needs_review").notNull().default(false),
  issues: jsonb("issues").notNull().default([]),
}).enableRLS();

/** Aviso de privacidade mostrado e aceito (LGPD). Ligado à conversa: o aviso vem antes de existir lead. */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    conversationId: uuid("conversation_id").notNull(),
    scope: text("scope").notNull(),
    textShown: text("text_shown").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "consents_conversation_fk",
      columns: [t.organizationId, t.conversationId],
      foreignColumns: [conversations.organizationId, conversations.id],
    }).onDelete("cascade"),
  ],
).enableRLS();
