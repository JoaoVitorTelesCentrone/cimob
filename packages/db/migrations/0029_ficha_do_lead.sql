-- Ficha do lead: 1ª resposta, próximo passo e visita por função (com histórico e hora do servidor).
-- Brecha fechada: pela política de UPDATE o corretor dono podia gravar qualquer coluna do lead
-- (inclusive first_response_at, assigned_at, owner_id e created_at). Agora, direto pelo app, só
-- estágio, motivo da perda e os dados de qualificação; o resto passa pelas funções.
ALTER TABLE leads ADD CONSTRAINT leads_next_step_check
  CHECK (next_step IS NULL OR (btrim(next_step) <> '' AND length(next_step) <= 200));
--> statement-breakpoint
REVOKE UPDATE ON leads FROM authenticated;
--> statement-breakpoint
GRANT UPDATE (stage, lost_reason, name, intent, budget_range, timeframe, wants_visit, unit_id, property_id)
  ON leads TO authenticated;
--> statement-breakpoint

-- Quem trabalha o lead: o corretor dono ou o gestor da imobiliária. Sem usuário (sistema) também.
CREATE FUNCTION public.lead_for_work(p_lead uuid) RETURNS leads
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads%ROWTYPE;
BEGIN
  SELECT * INTO target FROM leads WHERE id = p_lead FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL
     OR NOT (public.is_org_admin(target.organization_id)
             OR (public.is_member(target.organization_id) AND target.owner_id = auth.uid())) THEN
    RAISE EXCEPTION 'not allowed to work on this lead' USING ERRCODE = '42501';
  END IF;
  RETURN target;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lead_for_work(uuid) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- 1ª resposta com a hora do servidor; uma vez registrada, não muda.
CREATE FUNCTION public.record_first_response(p_lead uuid) RETURNS timestamptz
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads := public.lead_for_work(p_lead);
BEGIN
  IF target.first_response_at IS NOT NULL THEN
    RETURN target.first_response_at;
  END IF;
  UPDATE leads SET first_response_at = now() WHERE id = target.id;
  INSERT INTO lead_events (organization_id, lead_id, type, data, actor_id)
  VALUES (target.organization_id, target.id, 'first_response', '{}', auth.uid());
  RETURN now();
END;
$$;
--> statement-breakpoint

-- Próximo passo (texto curto + quando). Texto vazio limpa.
CREATE FUNCTION public.set_next_step(p_lead uuid, p_text text, p_at timestamptz) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads := public.lead_for_work(p_lead);
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
BEGIN
  UPDATE leads SET next_step = v_text, next_step_at = CASE WHEN v_text IS NULL THEN NULL ELSE p_at END
   WHERE id = target.id;
  IF v_text IS NOT NULL THEN
    INSERT INTO lead_events (organization_id, lead_id, type, data, actor_id)
    VALUES (target.organization_id, target.id, 'next_step',
            jsonb_strip_nulls(jsonb_build_object('text', v_text, 'at', p_at)), auth.uid());
  END IF;
END;
$$;
--> statement-breakpoint

-- Data da visita. Lead que ainda não chegou a "Visita agendada" vai para lá (o trigger registra o estágio).
CREATE FUNCTION public.set_visit_at(p_lead uuid, p_at timestamptz) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads := public.lead_for_work(p_lead);
BEGIN
  UPDATE leads SET visit_at = p_at,
    stage = CASE WHEN p_at IS NOT NULL AND stage IN ('new', 'qualified', 'contacted')
                 THEN 'visit_scheduled'::lead_stage ELSE stage END
   WHERE id = target.id;
  IF p_at IS NOT NULL THEN
    INSERT INTO lead_events (organization_id, lead_id, type, data, actor_id)
    VALUES (target.organization_id, target.id, 'visit_scheduled_at', jsonb_build_object('at', p_at), auth.uid());
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_first_response(uuid), public.set_next_step(uuid, text, timestamptz),
  public.set_visit_at(uuid, timestamptz) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_first_response(uuid), public.set_next_step(uuid, text, timestamptz),
  public.set_visit_at(uuid, timestamptz) TO authenticated, service_role;
