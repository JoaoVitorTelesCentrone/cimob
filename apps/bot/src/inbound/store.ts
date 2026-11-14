import type postgres from "postgres";
import type { DeliveryStatus, InboundMessage } from "./parse.ts";

export type Recorded = { conversationId: string; leadId: string | null; messageId: string };

/** Onde o worker grava. A implementação real é Postgres; os testes de unidade usam uma falsa. */
export type InboundStore = {
  findOrganization(phoneNumberId: string): Promise<string | null>;
  /**
   * Grava a mensagem e, só se ela for nova, chama `handle` na mesma transação.
   * Se `handle` falhar, nada fica gravado e a fila pode tentar de novo.
   * `isNew` é falso quando a mensagem já existia (entrega repetida).
   */
  recordInbound(
    organizationId: string,
    message: InboundMessage,
    handle: (recorded: Recorded, tx: postgres.TransactionSql) => Promise<void>,
  ): Promise<{ isNew: boolean; conversationId: string }>;
  /**
   * Grava entregue/lida/falha na mensagem enviada com esse wamid, só dentro da imobiliária.
   * `updated` é falso quando a mensagem não é dela (ou não existe).
   */
  recordStatus(
    organizationId: string,
    status: DeliveryStatus,
  ): Promise<{ updated: boolean; orgName: string }>;
};

/**
 * Conexão direta do bot (fora do RLS, como sistema). Toda consulta filtra pelo organization_id
 * resolvido a partir do phone_number_id: o bot nunca cruza dados de imobiliárias.
 */
export function createPostgresStore(sql: postgres.Sql): InboundStore {
  return {
    async recordStatus(organizationId, status) {
      const at = status.at;
      const rows =
        status.status === "failed"
          ? await sql`
              update messages set send_status = 'failed', send_error = ${status.error}
              where organization_id = ${organizationId} and wa_message_id = ${status.waMessageId}
                and direction = 'outbound'
              returning id`
          : status.status === "read"
            ? await sql`
                update messages
                set read_at = coalesce(read_at, ${at}), delivered_at = coalesce(delivered_at, ${at})
                where organization_id = ${organizationId} and wa_message_id = ${status.waMessageId}
                  and direction = 'outbound'
                returning id`
            : await sql`
                update messages set delivered_at = coalesce(delivered_at, ${at})
                where organization_id = ${organizationId} and wa_message_id = ${status.waMessageId}
                  and direction = 'outbound'
                returning id`;
      const [org] = await sql<{ name: string }[]>`
        select name from organizations where id = ${organizationId}`;
      return { updated: rows.length > 0, orgName: org?.name ?? "?" };
    },

    async findOrganization(phoneNumberId) {
      const [row] = await sql<{ organization_id: string }[]>`
        select organization_id from whatsapp_accounts where phone_number_id = ${phoneNumberId}`;
      return row?.organization_id ?? null;
    },

    async recordInbound(organizationId, m, handle) {
      let isNew = false;
      let conversationId = "";
      await sql.begin(async (tx) => {
        const [conv] = await tx<{ id: string; lead_id: string | null }[]>`
          insert into conversations (organization_id, wa_contact, last_inbound_at, phone_number_id)
          values (${organizationId}, ${m.from}, ${m.sentAt}, ${m.phoneNumberId})
          on conflict (organization_id, wa_contact) do update
            set last_inbound_at = greatest(conversations.last_inbound_at, excluded.last_inbound_at),
                -- A resposta sai pelo número com que o contato falou por último.
                phone_number_id = excluded.phone_number_id
          returning id, lead_id`;
        if (!conv) throw new Error("conversa não gravada");
        conversationId = conv.id;

        // Contato que já é lead (ex.: cadastrado no CRM) fica ligado à conversa.
        let leadId = conv.lead_id;
        if (!leadId) {
          const [linked] = await tx<{ lead_id: string | null }[]>`
            update conversations set lead_id = (
              select id from leads where organization_id = ${organizationId} and phone = ${m.from}
            )
            where id = ${conv.id} and lead_id is null
            returning lead_id`;
          leadId = linked?.lead_id ?? null;
        }

        // Idempotência: entrega repetida (ou processada em paralelo) não grava de novo.
        // Em paralelo, a segunda transação espera a primeira no índice único e cai no "do nothing".
        const inserted = await tx<{ id: string }[]>`
          insert into messages (organization_id, conversation_id, wa_message_id, direction, type, body, payload)
          values (${organizationId}, ${conv.id}, ${m.waMessageId}, 'inbound', ${m.type}, ${m.body},
                  ${tx.json(m.raw as postgres.JSONValue)})
          on conflict (wa_message_id) do nothing
          returning id`;
        const [message] = inserted;
        if (!message) return;

        isNew = true;
        await handle({ conversationId: conv.id, leadId, messageId: message.id }, tx);
      });
      return { isNew, conversationId };
    },
  };
}
