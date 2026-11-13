-- LGPD (T4.2): exportar e excluir os dados de um lead. Só o gestor da imobiliária (ou o sistema,
-- sem usuário no JWT). Mesma mensagem para "não existe" e "não pode": não revela leads de outra imobiliária.

-- Registro anônimo de exclusão: o gestor lê o da própria imobiliária; ninguém grava pelo app.
REVOKE ALL ON "lead_data_deletions" FROM anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "lead_data_deletions" FROM authenticated;
--> statement-breakpoint
CREATE POLICY "admins read own deletions" ON lead_data_deletions
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- Conversas do contato (não as de corretor): ligadas ao lead ou, sem lead, pelo mesmo número.
CREATE FUNCTION public.lead_contact_conversations(target leads) RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id FROM conversations c
  WHERE c.organization_id = target.organization_id
    AND c.agent_user_id IS NULL
    AND (c.lead_id = target.id OR (c.lead_id IS NULL AND c.wa_contact = target.phone));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lead_contact_conversations(leads) FROM PUBLIC;
--> statement-breakpoint

CREATE FUNCTION public.export_lead_data(lead uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO target FROM leads WHERE id = lead;
  IF NOT FOUND OR (auth.uid() IS NOT NULL AND NOT public.is_org_admin(target.organization_id)) THEN
    RAISE EXCEPTION 'not allowed to export this lead' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'organization', (SELECT jsonb_build_object('name', o.name) FROM organizations o WHERE o.id = target.organization_id),
    'lead', jsonb_build_object(
      'name', target.name, 'phone', target.phone, 'source', target.source,
      'unit', (SELECT u.code FROM units u WHERE u.id = target.unit_id),
      'intent', target.intent, 'budget_range', target.budget_range, 'timeframe', target.timeframe,
      'wants_visit', target.wants_visit, 'stage', target.stage, 'visit_at', target.visit_at,
      'lost_reason', target.lost_reason, 'created_at', target.created_at),
    'messages', coalesce((
      SELECT jsonb_agg(jsonb_build_object('direction', m.direction, 'type', m.type, 'body', m.body,
                                          'created_at', m.created_at) ORDER BY m.created_at, m.id)
      FROM messages m
      WHERE m.conversation_id IN (SELECT public.lead_contact_conversations(target))), '[]'),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', e.type, 'data', e.data, 'created_at', e.created_at)
                       ORDER BY e.created_at, e.id)
      FROM lead_events e WHERE e.lead_id = target.id AND e.organization_id = target.organization_id), '[]'),
    'consents', coalesce((
      SELECT jsonb_agg(jsonb_build_object('scope', c.scope, 'text_shown', c.text_shown, 'created_at', c.created_at)
                       ORDER BY c.created_at, c.id)
      FROM consents c
      WHERE c.conversation_id IN (SELECT public.lead_contact_conversations(target))), '[]')
  ) INTO result;

  -- Quem exportou fica no histórico (acesso a dado pessoal é auditável).
  INSERT INTO lead_events (organization_id, lead_id, type, data, actor_id)
  VALUES (target.organization_id, target.id, 'data_exported', '{}', auth.uid());
  RETURN result;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.export_lead_data(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.export_lead_data(uuid) TO authenticated, service_role;
--> statement-breakpoint

CREATE FUNCTION public.delete_lead_data(lead uuid) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads%ROWTYPE;
  ref text;
  n_conversations int;
  n_messages int;
  n_events int;
  n_agent_messages int;
  deletion uuid;
BEGIN
  SELECT * INTO target FROM leads WHERE id = lead FOR UPDATE;
  IF NOT FOUND OR (auth.uid() IS NOT NULL AND NOT public.is_org_admin(target.organization_id)) THEN
    RAISE EXCEPTION 'not allowed to delete this lead' USING ERRCODE = '42501';
  END IF;
  ref := target.id::text;

  SELECT count(*) INTO n_messages FROM messages
   WHERE conversation_id IN (SELECT public.lead_contact_conversations(target));
  SELECT count(*) INTO n_events FROM lead_events
   WHERE lead_id = target.id AND organization_id = target.organization_id;

  -- Resumo e perguntas enviados ao WhatsApp do corretor (e as respostas dele) citam o lead pelo id.
  DELETE FROM messages m USING conversations c
   WHERE m.conversation_id = c.id AND c.organization_id = target.organization_id
     AND c.agent_user_id IS NOT NULL AND m.payload::text LIKE '%' || ref || '%';
  GET DIAGNOSTICS n_agent_messages = ROW_COUNT;
  UPDATE conversations SET flow_data = '{}'
   WHERE organization_id = target.organization_id AND agent_user_id IS NOT NULL
     AND flow_data::text LIKE '%' || ref || '%';

  -- Conversas do contato (o cascade leva mensagens e consentimentos), depois o lead (leva o histórico).
  DELETE FROM conversations WHERE id IN (SELECT public.lead_contact_conversations(target));
  GET DIAGNOSTICS n_conversations = ROW_COUNT;
  DELETE FROM leads WHERE id = target.id;

  INSERT INTO lead_data_deletions (organization_id, actor_id, summary, is_demo)
  VALUES (target.organization_id, auth.uid(),
          jsonb_build_object('conversations', n_conversations, 'messages', n_messages,
                             'events', n_events, 'agent_messages', n_agent_messages),
          target.is_demo)
  RETURNING id INTO deletion;
  RETURN deletion;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.delete_lead_data(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.delete_lead_data(uuid) TO authenticated, service_role;
