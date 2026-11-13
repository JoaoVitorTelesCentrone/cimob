-- Rodízio de leads (doc 06): round-robin entre os membros ativos com in_rotation.
-- Ordem pelo nome exibido (e user_id para desempatar); organizations.rotation_cursor guarda quem recebeu por último.
--
-- Quem pode acionar: o sistema (service role do bot, sem usuário no JWT) ou o gestor da organização do lead.
-- security definer porque o gestor não escreve em organizations.rotation_cursor nem lê toda a equipe por outra via.
-- O FOR UPDATE na organização serializa atribuições concorrentes: dois leads simultâneos não caem no mesmo corretor.

-- Próximo da vez, sem atribuir nada. Fonte única da ordem do rodízio (o CRM mostra isso na tela de equipe).
CREATE FUNCTION public.next_in_rotation(org uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ring AS (
    SELECT user_id, COALESCE(display_name, '') AS name
      FROM memberships
     WHERE organization_id = org AND active AND in_rotation
  ), last AS (
    SELECT m.user_id, COALESCE(m.display_name, '') AS name
      FROM memberships m JOIN organizations o ON o.id = m.organization_id
     WHERE m.organization_id = org AND m.user_id = o.rotation_cursor
  )
  -- Primeiro quem vem depois do último que recebeu; se ninguém, volta ao começo da fila.
  SELECT r.user_id
    FROM ring r
   WHERE auth.uid() IS NULL OR public.is_org_admin(org)
   ORDER BY EXISTS (SELECT 1 FROM last WHERE (r.name, r.user_id) > (last.name, last.user_id)) DESC,
            r.name, r.user_id
   LIMIT 1;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.next_in_rotation(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.next_in_rotation(uuid) TO authenticated, service_role;
--> statement-breakpoint

CREATE FUNCTION public.assign_lead_by_rotation(lead uuid) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target leads%ROWTYPE;
  next_user uuid;
BEGIN
  SELECT * INTO target FROM leads WHERE id = lead FOR UPDATE;
  -- Mesma mensagem para "não existe" e "não pode": não revela leads de outra organização.
  IF NOT FOUND OR (auth.uid() IS NOT NULL AND NOT public.is_org_admin(target.organization_id)) THEN
    RAISE EXCEPTION 'not allowed to assign this lead' USING ERRCODE = '42501';
  END IF;

  IF target.owner_id IS NOT NULL THEN
    RETURN target.owner_id;
  END IF;

  -- Trava a organização: atribuições simultâneas esperam a vez e leem o ponteiro já atualizado.
  PERFORM 1 FROM organizations WHERE id = target.organization_id FOR UPDATE;
  next_user := public.next_in_rotation(target.organization_id);

  IF next_user IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE leads
     SET owner_id = next_user, assigned_at = now(), first_response_at = NULL
   WHERE id = lead;
  UPDATE organizations SET rotation_cursor = next_user WHERE id = target.organization_id;
  INSERT INTO lead_events (organization_id, lead_id, type, data, actor_id)
  VALUES (target.organization_id, lead, 'assigned',
          jsonb_build_object('to', next_user, 'by', 'rotation'), auth.uid());

  RETURN next_user;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.assign_lead_by_rotation(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.assign_lead_by_rotation(uuid) TO authenticated, service_role;
--> statement-breakpoint

-- memberships: o gestor liga e desliga o rodízio da equipe pelo app. Só essa coluna; o resto segue com a service role.
REVOKE UPDATE ON memberships FROM authenticated;
--> statement-breakpoint
GRANT UPDATE (in_rotation) ON memberships TO authenticated;
--> statement-breakpoint
CREATE POLICY "admins toggle team rotation" ON memberships
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));
