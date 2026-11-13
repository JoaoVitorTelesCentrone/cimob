import type postgres from "postgres";
import { toCloudMessage } from "../flow/cloud.ts";
import type { NewMessage } from "../inbound/process.ts";
import { newLeadTemplate, parseAgentReply, STAGE_OPTIONS, type StageCode } from "./templates.ts";

type Tx = postgres.TransactionSql;

const STAGE_LABEL: Partial<Record<StageCode, string>> = {
  visit_scheduled: "Visita agendada",
  visit_done: "Visita feita",
  proposal: "Proposta",
};
const MAX_REASON = 300;

/** Mensagem de saída numa conversa (pendente: o worker de envio manda depois do commit). */
async function queue(
  tx: Tx,
  organizationId: string,
  conversationId: string,
  payload: Record<string, unknown>,
  body: string,
): Promise<void> {
  await tx`
    insert into messages (organization_id, conversation_id, direction, type, body, payload,
                          send_status, created_at)
    values (${organizationId}, ${conversationId}, 'outbound', ${String(payload["type"])}, ${body},
            ${tx.json(payload as postgres.JSONValue)}, 'pending', clock_timestamp())`;
}

/** Corretor ativo da imobiliária com este WhatsApp, se houver. */
export async function agentByPhone(tx: Tx, organizationId: string, phone: string) {
  const [row] = await tx<{ user_id: string }[]>`
    select user_id from memberships
    where organization_id = ${organizationId} and whatsapp = ${phone} and active`;
  return row?.user_id ?? null;
}

/** Conversa da imobiliária com o corretor (uma por número). */
async function agentConversation(
  tx: Tx,
  organizationId: string,
  agent: { userId: string; whatsapp: string },
  phoneNumberId: string | null,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into conversations (organization_id, wa_contact, agent_user_id, phone_number_id, state)
    values (${organizationId}, ${agent.whatsapp}, ${agent.userId}, ${phoneNumberId}, 'agent')
    on conflict (organization_id, wa_contact) do update
      set agent_user_id = excluded.agent_user_id,
          phone_number_id = coalesce(excluded.phone_number_id, conversations.phone_number_id)
    returning id`;
  if (!row) throw new Error("conversa do corretor não gravada");
  return row.id;
}

/**
 * Lead passado a um corretor: manda o resumo (modelo novo_lead) para o WhatsApp dele.
 * Sem WhatsApp cadastrado, fica registrado no histórico do lead para o gestor ver.
 */
export async function notifyAgentOfLead(tx: Tx, m: NewMessage, leadId: string): Promise<void> {
  const [lead] = await tx<
    {
      owner_id: string | null;
      whatsapp: string | null;
      name: string | null;
      phone: string;
      unit_code: string | null;
      intent: string | null;
      budget_range: string | null;
      timeframe: string | null;
      wants_visit: boolean | null;
      question: string | null;
      phone_number_id: string | null;
    }[]
  >`
    select l.owner_id, mb.whatsapp, l.name, l.phone, u.code as unit_code, l.intent, l.budget_range,
           l.timeframe, l.wants_visit,
           (select e.data->>'question' from lead_events e
             where e.lead_id = l.id and e.type = 'question_for_agent'
             order by e.created_at desc limit 1) as question,
           c.phone_number_id
    from leads l
    left join memberships mb on mb.organization_id = l.organization_id and mb.user_id = l.owner_id
    left join units u on u.id = l.unit_id
    join conversations c on c.id = ${m.conversationId}
    where l.id = ${leadId} and l.organization_id = ${m.organizationId}`;
  if (!lead?.owner_id) return;
  if (!lead.whatsapp) {
    await tx`insert into lead_events (organization_id, lead_id, type, data)
             values (${m.organizationId}, ${leadId}, 'agent_not_notified',
                     ${tx.json({ reason: "sem WhatsApp cadastrado" })})`;
    return;
  }

  const profile = [
    lead.intent,
    lead.budget_range,
    lead.timeframe,
    lead.wants_visit === null ? null : lead.wants_visit ? "quer visitar" : "ainda não quer visitar",
  ]
    .filter(Boolean)
    .join(" · ");
  const conversationId = await agentConversation(
    tx,
    m.organizationId,
    { userId: lead.owner_id, whatsapp: lead.whatsapp },
    lead.phone_number_id,
  );
  const payload = newLeadTemplate(lead.whatsapp, {
    leadId,
    leadName: lead.name,
    unit: lead.unit_code,
    profile,
    question: lead.question,
    contactLink: `https://wa.me/${lead.phone}`,
  });
  await queue(
    tx,
    m.organizationId,
    conversationId,
    payload,
    `Resumo do lead ${lead.name ?? lead.phone}`,
  );
  m.notify(conversationId);
}

/** Mensagem que chegou do WhatsApp de um corretor: botões do resumo e da pergunta de estágio. */
export async function handleAgentMessage(
  tx: Tx,
  m: NewMessage,
  agentUserId: string,
  flowData: { awaitingLostReason?: string },
): Promise<void> {
  const reply = async (text: string) => {
    await queue(
      tx,
      m.organizationId,
      m.conversationId,
      toCloudMessage(m.message.from, { kind: "text", body: text }),
      text,
    );
  };
  const ownLead = async (leadId: string) => {
    const [row] = await tx<{ id: string; name: string | null; phone: string }[]>`
      select id, name, phone from leads
      where id = ${leadId} and organization_id = ${m.organizationId} and owner_id = ${agentUserId}`;
    return row ?? null;
  };
  const markResponded = async (leadId: string, via: string) => {
    await tx`update leads set first_response_at = coalesce(first_response_at, now()) where id = ${leadId}`;
    await tx`insert into lead_events (organization_id, lead_id, type, data, actor_id)
             values (${m.organizationId}, ${leadId}, 'agent_reply', ${tx.json({ via })}, ${agentUserId})`;
  };
  const setFlow = async (data: Record<string, string>) => {
    await tx`update conversations set flow_data = ${tx.json(data)} where id = ${m.conversationId}`;
  };

  const action = parseAgentReply(m.message.replyId);

  // Motivo da perda pedido no passo anterior: o texto livre é o motivo.
  if (!action && flowData.awaitingLostReason && m.message.body?.trim()) {
    const lead = await ownLead(flowData.awaitingLostReason);
    await setFlow({});
    if (!lead) return reply("Esse lead não está mais com você.");
    const reason = m.message.body.trim().slice(0, MAX_REASON);
    await tx`update leads set stage = 'lost', lost_reason = ${reason} where id = ${lead.id}`;
    return reply(`Anotado: ${lead.name ?? lead.phone} marcado como perdido.`);
  }

  if (!action) {
    return reply(
      "Por aqui eu só registro as respostas dos botões. Para ver os seus leads, use o CRM.",
    );
  }
  const lead = await ownLead(action.leadId);
  if (!lead) return reply("Esse lead não está com você.");
  const name = lead.name ?? lead.phone;

  if (action.kind === "responded") {
    await markResponded(lead.id, "novo_lead");
    return reply(`Anotado ✅ Obrigado por avisar que já falou com ${name}.`);
  }

  await markResponded(lead.id, `atualizar_lead:${action.code}`);
  if (action.code === "lost") {
    await setFlow({ awaitingLostReason: lead.id });
    return reply(`Qual o motivo da perda de ${name}?`);
  }
  if (action.code === "no_response") {
    return reply(`Anotado: ${name} ainda sem resposta. O lead continua no mesmo estágio.`);
  }
  await tx`update leads set stage = ${action.code}::lead_stage where id = ${lead.id}`;
  const label =
    STAGE_LABEL[action.code] ?? STAGE_OPTIONS.find((o) => o.code === action.code)?.title;
  return reply(`Anotado: ${name} agora está em ${label ?? action.code}.`);
}
