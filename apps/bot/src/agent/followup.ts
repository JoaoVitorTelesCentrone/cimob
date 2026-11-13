import type postgres from "postgres";
import { stageTemplate } from "./templates.ts";

const FOLLOW_UP_AFTER_HOURS = 24;
const MAX_PER_RUN = 100;

/**
 * Pergunta de estágio (doc 04): 24 h depois da passagem, o corretor recebe o modelo
 * atualizar_lead com as opções 1–5. Uma vez por lead (evento `stage_followup_sent`).
 * Devolve as conversas de corretor que ganharam mensagem, para a fila de envio.
 */
export async function runFollowUps(sql: postgres.Sql): Promise<string[]> {
  return sql.begin(async (tx) => {
    const due = await tx<
      {
        lead_id: string;
        organization_id: string;
        name: string | null;
        unit_code: string | null;
        owner_id: string;
        whatsapp: string;
        phone_number_id: string | null;
      }[]
    >`
      select l.id as lead_id, l.organization_id, l.name, u.code as unit_code, l.owner_id,
             mb.whatsapp, c.phone_number_id
      from leads l
      join memberships mb on mb.organization_id = l.organization_id and mb.user_id = l.owner_id
                          and mb.active and mb.whatsapp is not null
      left join units u on u.id = l.unit_id
      left join conversations c on c.lead_id = l.id and c.organization_id = l.organization_id
      where l.stage not in ('won', 'lost')
        and exists (select 1 from lead_events e
                    where e.lead_id = l.id and e.type = 'handoff'
                      and e.created_at < now() - make_interval(hours => ${FOLLOW_UP_AFTER_HOURS}))
        and not exists (select 1 from lead_events f
                        where f.lead_id = l.id and f.type = 'stage_followup_sent')
      order by l.assigned_at
      limit ${MAX_PER_RUN}
      for update of l skip locked`;

    const touched = new Set<string>();
    for (const d of due) {
      const [conv] = await tx<{ id: string }[]>`
        insert into conversations (organization_id, wa_contact, agent_user_id, phone_number_id, state)
        values (${d.organization_id}, ${d.whatsapp}, ${d.owner_id}, ${d.phone_number_id}, 'agent')
        on conflict (organization_id, wa_contact) do update
          set agent_user_id = excluded.agent_user_id,
              phone_number_id = coalesce(conversations.phone_number_id, excluded.phone_number_id)
        returning id`;
      if (!conv) continue;
      const payload = stageTemplate(d.whatsapp, {
        leadId: d.lead_id,
        leadName: d.name,
        unit: d.unit_code,
      });
      await tx`
        insert into messages (organization_id, conversation_id, direction, type, body, payload,
                              send_status, created_at)
        values (${d.organization_id}, ${conv.id}, 'outbound', 'template',
                ${`Pergunta de estágio: ${d.name ?? "lead"}`},
                ${tx.json(payload as postgres.JSONValue)}, 'pending', clock_timestamp())`;
      await tx`insert into lead_events (organization_id, lead_id, type, data)
               values (${d.organization_id}, ${d.lead_id}, 'stage_followup_sent', '{}')`;
      touched.add(conv.id);
    }
    return [...touched];
  });
}
