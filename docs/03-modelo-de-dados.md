# 03 · Modelo de dados (Supabase + Drizzle)

Toda tabela de negócio tem `organization_id uuid not null` e RLS. As datas são `timestamptz`, e os IDs, `uuid` (`gen_random_uuid()`).

## Tabelas
| Tabela | Campos principais | Notas |
|---|---|---|
| organizations | id, name, slug, custom_domain, brand jsonb, plan, rotation_cursor, qualify_timeframe (`3m`/`6m`/`any`), qualify_price_share (0,50–1,00), is_demo, created_at | Tenant. Pelo app o gestor muda só `name`, `brand` e `qualify_*` |
| platform_admins | user_id, created_at | Equipe da Center One. Ninguém lê pelo app; `is_platform_admin()` responde |
| invitations | id, organization_id, email (minúsculas), role (`org_admin`/`agent`), display_name, whatsapp, invited_by, accepted_by, accepted_at, is_demo | Convite; vira membership na 1ª entrada (`accept_my_invitations`) |
| memberships | id, organization_id, user_id, role (`agency_admin`, `org_admin`, `agent`), active, in_rotation | Papel por organização |
| whatsapp_accounts | id, organization_id, phone_number_id (único no banco), waba_id, display_phone, token_secret_id | Token no Vault. Só o gestor lê |
| developments | id, organization_id, name, address, lat, lng, model_url (GLB), delivery_date, published, is_demo | Empreendimento. Só `published` aparece no site público |
| units | id, organization_id, development_id, code (AUR-502), floor, position, area_m2, bedrooms, parking, price, status (`available`, `reserved`, `sold`), mesh_name, plan_url, is_demo | `mesh_name` liga a unidade ao objeto do GLB |
| properties | id, organization_id, code (AP-123), title, neighborhood, price, area_m2, bedrooms, status, fields jsonb, is_demo | Imóvel avulso (usado). Sem leitura anônima |
| leads | id, organization_id, name, phone, source, ad_id, campaign_id, unit_id, property_id, intent, budget_range, timeframe, wants_visit, qualified, stage, owner_id, assigned_at, first_response_at, visit_at, lost_reason, is_demo, created_at | `phone` + organization_id únicos |
| conversations | id, organization_id, lead_id, wa_contact, state, bot_paused, last_inbound_at, is_demo | Estado da máquina. Uma por contato em cada imobiliária. Apagar o lead apaga a conversa (LGPD) |
| messages | id, organization_id, conversation_id, wa_message_id (único), direction (`inbound`, `outbound`), type, body, payload jsonb, is_demo, created_at | Idempotência |
| lead_events | id, organization_id, lead_id, type, data jsonb, actor_id, created_at | Histórico/auditoria |
| consents | id, organization_id, conversation_id, scope, text_shown, is_demo, created_at | LGPD. Ligado à conversa: o aviso aparece antes de existir lead |
| ad_spend_daily | id, organization_id, date, ad_id, campaign_id, spend, impressions, clicks | Importado da Meta |
| meta_ads_accounts | id, organization_id, ad_account_id (único no banco), token_secret_id | Conta de anúncios; token no Vault. Só o gestor lê |
| lead_data_deletions | id, organization_id, actor_id, summary jsonb, is_demo, deleted_at | LGPD: prova anônima de exclusão (contagens, sem nome/telefone/id do lead). Só `delete_lead_data` grava |

Integridade entre organizações: `developments`, `units`, `properties` e `leads` têm `unique (organization_id, id)`, e as chaves estrangeiras de `units`, `leads` e `lead_events` são compostas `(organization_id, <pai>_id)`. Um lead nunca aponta para unidade de outra imobiliária, mesmo com a service role. `lead_events` só aceita inserção (histórico não se altera).

Enums `unit_status` (`available`, `reserved`, `sold`) e `lead_stage`: `new`, `qualified`, `contacted`, `visit_scheduled`, `visit_done`, `proposal`, `won`, `lost`.

## RLS (padrão)
```sql
alter table leads enable row level security;

create policy "members read org leads" on leads for select
using (organization_id in (
  select organization_id from memberships
  where user_id = auth.uid() and active
));

-- corretor só vê os próprios leads
create policy "agents see own leads" on leads for select
using (
  exists (select 1 from memberships m
          where m.user_id = auth.uid() and m.organization_id = leads.organization_id
            and (m.role in ('org_admin','agency_admin') or leads.owner_id = auth.uid()))
);
```
Dados do bot (`0011`): o app só lê. O gestor vê conversas, mensagens e consentimentos da imobiliária; o corretor, só os dos leads dele (a policy reaproveita o RLS de `leads`). Ninguém grava por aqui; quem grava é o `apps/bot`.

Policies implementadas em `packages/db/migrations` (`0001`, `0002`, `0004`, `0008`, `0011`): `is_member`, `role_in`, `is_org_admin`, `development_is_published` e `resolve_tenant` (consulta pública do site). O anônimo não tem acesso a `leads`, `lead_events` e `properties`. Corretor só altera lead próprio; só gestor altera estoque.

Seed de demonstração: `pnpm db:seed` (idempotente) e `pnpm db:seed -- --remove`. Toda linha leva `is_demo = true`.

Use funções `security definer` (`is_member(org)`, `role_in(org)`) para não repetir subqueries. O `apps/bot` usa a service role e **sempre** filtra por `organization_id` vindo do `phone_number_id` do webhook.

## Testes obrigatórios de RLS
- Usuário da org A não lê leads, unidades nem mensagens da org B.
- Corretor não lê lead de outro corretor; gestor lê todos da org.
- Anônimo lê só `units` e `developments` publicados (para o site), nunca `leads`.
