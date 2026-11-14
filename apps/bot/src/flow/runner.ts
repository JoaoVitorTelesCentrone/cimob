import type { ExtractRequest, Extractor } from "@c1imob/ai";
import { extractUnitCode } from "@c1imob/core";
import type postgres from "postgres";
import { agentByPhone, handleAgentMessage, notifyAgentOfLead } from "../agent/agent.ts";
import type { NewMessage } from "../inbound/process.ts";
import { toCloudMessage } from "./cloud.ts";
import {
  step,
  type Extracted,
  type FlowData,
  type FlowState,
  type Snapshot,
  type UnitInfo,
} from "./machine.ts";
import { BUDGET, GOAL, TIMEFRAME } from "./options.ts";
import type { Criteria } from "./qualify.ts";

type Tx = postgres.TransactionSql;

/** Origem gravada no lead que chega pelo WhatsApp. */
export const WHATSAPP_SOURCE = "whatsapp";
/** Origem do lead que chega por anúncio click-to-WhatsApp (o painel cruza com o gasto da Meta). */
export const META_ADS_SOURCE = "meta_ads";

/**
 * Garante o lead da conversa (decisão: o lead nasce na 1ª mensagem, como "Novo") e liga a unidade
 * pelo código da mensagem, se existir nesta imobiliária. Mensagem vinda de anúncio marca a origem
 * e o anúncio; quem volta por outro anúncio passa a apontar para o último clicado.
 */
async function ensureLead(tx: Tx, m: NewMessage): Promise<string> {
  const code = m.message.body ? extractUnitCode(m.message.body) : null;
  const [unit] = code
    ? await tx<{ id: string }[]>`
        select id from units where organization_id = ${m.organizationId} and code = ${code}`
    : [];

  const adId = m.message.adId;
  if (m.leadId) {
    if (adId) {
      await tx`update leads set source = ${META_ADS_SOURCE}, ad_id = ${adId}
               where id = ${m.leadId} and organization_id = ${m.organizationId}`;
    }
    if (unit) {
      await tx`update leads set unit_id = ${unit.id}
               where id = ${m.leadId} and organization_id = ${m.organizationId} and unit_id is null`;
    }
    return m.leadId;
  }
  const [lead] = await tx<{ id: string }[]>`
    insert into leads (organization_id, phone, source, ad_id, unit_id)
    values (${m.organizationId}, ${m.message.from}, ${adId ? META_ADS_SOURCE : WHATSAPP_SOURCE},
            ${adId}, ${unit?.id ?? null})
    on conflict (organization_id, phone) do update
      set source = case when excluded.ad_id is null then leads.source else excluded.source end,
          ad_id = coalesce(excluded.ad_id, leads.ad_id)
    returning id`;
  if (!lead) throw new Error("lead não criado");
  await tx`update conversations set lead_id = ${lead.id} where id = ${m.conversationId}`;
  return lead.id;
}

async function snapshot(tx: Tx, m: NewMessage, leadId: string, state: FlowState, data: FlowData) {
  const [row] = await tx<
    {
      name: string | null;
      intent: string | null;
      budget_range: string | null;
      timeframe: string | null;
      wants_visit: boolean | null;
      unit_code: string | null;
      unit_price: string | null;
      unit_status: UnitInfo["status"] | null;
      unit_area_m2: string | null;
      unit_bedrooms: number | null;
      unit_parking: number | null;
      org_name: string;
      privacy_url: string | null;
      qualify_timeframe: Criteria["timeframe"];
      qualify_price_share: string;
    }[]
  >`
    select l.name, l.intent, l.budget_range, l.timeframe, l.wants_visit,
           u.code as unit_code, u.price as unit_price, u.status::text as unit_status,
           u.area_m2 as unit_area_m2, u.bedrooms as unit_bedrooms, u.parking as unit_parking,
           o.name as org_name, o.brand->>'privacyUrl' as privacy_url,
           o.qualify_timeframe, o.qualify_price_share
    from leads l
    join organizations o on o.id = l.organization_id
    left join units u on u.id = l.unit_id
    where l.id = ${leadId} and l.organization_id = ${m.organizationId}`;
  if (!row) throw new Error("lead não encontrado");
  const s: Snapshot = {
    state,
    data,
    lead: {
      name: row.name,
      intent: row.intent,
      budgetRange: row.budget_range,
      timeframe: row.timeframe,
      wantsVisit: row.wants_visit,
    },
    unit:
      row.unit_code && row.unit_status
        ? {
            code: row.unit_code,
            price: row.unit_price === null ? null : Number(row.unit_price),
            status: row.unit_status,
            areaM2: row.unit_area_m2 === null ? null : Number(row.unit_area_m2),
            bedrooms: row.unit_bedrooms,
            parking: row.unit_parking,
          }
        : null,
    org: {
      name: row.org_name,
      privacyUrl: row.privacy_url,
      criteria: { timeframe: row.qualify_timeframe, priceShare: Number(row.qualify_price_share) },
    },
  };
  return s;
}

const PENDING: Partial<Record<FlowState, ExtractRequest["pending"]>> = {
  new: null,
  asking_goal: "goal",
  asking_budget: "budget",
  asking_timeframe: "timeframe",
  asking_visit: "visit",
  asking_name: "name",
};
const OPTIONS: ExtractRequest["options"] = {
  goal: GOAL.map(({ id, title }) => ({ id, title })),
  budget: BUDGET.map(({ id, title }) => ({ id, title })),
  timeframe: TIMEFRAME.map(({ id, title }) => ({ id, title })),
};
const MAX_ERROR = 200;

/**
 * Pede ao LLM o que ele entendeu, só para texto livre numa conversa em andamento (botão não
 * precisa; conversa com o corretor ou em nutrição também não). Falha não derruba o flow.
 */
async function understand(
  extractor: Extractor | undefined,
  s: Snapshot,
  m: NewMessage,
): Promise<{ extraction: Extracted | null; extractionFailed?: string }> {
  const text = m.message.body;
  const pending = PENDING[s.state];
  if (!extractor || m.message.replyId || !text || pending === undefined)
    return { extraction: null };
  try {
    const extraction = await extractor({
      text,
      pending,
      unitCode: s.unit?.code ?? null,
      options: OPTIONS,
    });
    return { extraction };
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, MAX_ERROR);
    return { extraction: null, extractionFailed: error };
  }
}

/**
 * Roda o flow para uma mensagem nova, dentro da transação em que ela foi gravada. As respostas
 * ficam em `messages` (saída, sem wa_message_id): o worker de envio (T2.6) manda depois do commit.
 */
export function createFlowHandler(opts: { extractor?: Extractor } = {}) {
  return async (m: NewMessage): Promise<void> => {
    const { tx } = m;
    const [conv] = await tx<
      { state: FlowState; flow_data: FlowData; bot_paused: boolean; agent_user_id: string | null }[]
    >`
      select state, flow_data, bot_paused, agent_user_id from conversations
      where id = ${m.conversationId} and organization_id = ${m.organizationId}
      for update`;
    if (!conv) throw new Error("conversa não encontrada");

    // Mensagem do WhatsApp de um corretor da imobiliária: resposta aos botões, nunca um lead.
    const agentUserId =
      conv.agent_user_id ?? (await agentByPhone(tx, m.organizationId, m.message.from));
    if (agentUserId) {
      if (!conv.agent_user_id) {
        await tx`update conversations set agent_user_id = ${agentUserId}, state = 'agent'
                 where id = ${m.conversationId}`;
      }
      await handleAgentMessage(
        tx,
        m,
        agentUserId,
        conv.flow_data as { awaitingLostReason?: string },
      );
      return;
    }
    if (conv.bot_paused) return; // Corretor atendendo: o bot não fala.

    // Áudio ainda sem texto: vai para a fila de transcrição; o bot responde quando o texto chegar.
    if (m.message.type === "audio" && m.message.body === null && !m.message.audioOutcome) {
      m.transcribe();
      return;
    }

    const leadId = await ensureLead(tx, m);
    const s = await snapshot(tx, m, leadId, conv.state, conv.flow_data);
    const o = step(s, {
      text: m.message.body,
      replyId: m.message.replyId,
      ...(m.message.audioOutcome
        ? { audio: m.message.audioOutcome }
        : await understand(opts.extractor, s, m)),
    });

    const lead = { ...s.lead, ...o.lead };
    await tx`
      update leads set
        name = ${lead.name}, intent = ${lead.intent}, budget_range = ${lead.budgetRange},
        timeframe = ${lead.timeframe}, wants_visit = ${lead.wantsVisit},
        qualified = coalesce(${o.qualified}, qualified),
        stage = case when ${o.qualified === true} and stage = 'new' then 'qualified'::lead_stage else stage end
      where id = ${leadId} and organization_id = ${m.organizationId}`;

    for (const e of o.events) {
      await tx`insert into lead_events (organization_id, lead_id, type, data)
               values (${m.organizationId}, ${leadId}, ${e.type}, ${tx.json(e.data)})`;
    }
    if (o.consent) {
      await tx`insert into consents (organization_id, conversation_id, scope, text_shown)
               values (${m.organizationId}, ${m.conversationId}, 'privacy_notice', ${o.consent})`;
    }
    if (o.handoff) {
      // Rodízio no banco (trava a organização; sem ninguém no rodízio, o lead fica sem dono).
      const [assigned] = await tx<{ owner: string | null }[]>`
        select public.assign_lead_by_rotation(${leadId}) as owner`;
      await tx`insert into lead_events (organization_id, lead_id, type, data)
               values (${m.organizationId}, ${leadId}, 'handoff',
                       ${tx.json({ reason: o.handoff, assigned: Boolean(assigned?.owner) })})`;
      // Resumo ao corretor que recebeu (modelo novo_lead).
      if (assigned?.owner) await notifyAgentOfLead(tx, m, leadId);
    }

    await tx`
      update conversations set state = ${o.state}, flow_data = ${tx.json(o.data)},
        bot_paused = ${o.state === "handed_off"}
      where id = ${m.conversationId}`;

    for (const reply of o.replies) {
      const payload = toCloudMessage(m.message.from, reply);
      // clock_timestamp: as respostas da mesma transação ficam na ordem em que foram escritas.
      await tx`
        insert into messages (organization_id, conversation_id, direction, type, body, payload,
                              send_status, created_at)
        values (${m.organizationId}, ${m.conversationId}, 'outbound', ${String(payload["type"])},
                ${reply.body}, ${tx.json(payload as postgres.JSONValue)}, 'pending', clock_timestamp())`;
    }
  };
}
