-- Donos de lead e autores de evento são usuários do Supabase Auth.
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_auth_users_fk"
  FOREIGN KEY ("owner_id") REFERENCES auth.users("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_id_auth_users_fk"
  FOREIGN KEY ("actor_id") REFERENCES auth.users("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE FUNCTION public.is_org_admin(org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.role_in(org) IN ('org_admin', 'agency_admin'), false);
$$;
--> statement-breakpoint

CREATE FUNCTION public.development_is_published(dev uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT published FROM developments WHERE id = dev), false);
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.is_org_admin(uuid), public.development_is_published(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
--> statement-breakpoint
-- O site público precisa saber se o empreendimento está publicado.
GRANT EXECUTE ON FUNCTION public.development_is_published(uuid) TO anon, authenticated, service_role;
--> statement-breakpoint

-- Dados de negócio sem uso público: o anônimo nem chega à tabela.
REVOKE ALL ON "leads", "lead_events", "properties" FROM anon;
--> statement-breakpoint

-- developments ---------------------------------------------------------
CREATE POLICY "public reads published developments" ON developments
  FOR SELECT TO anon, authenticated USING (published);
--> statement-breakpoint
CREATE POLICY "members read own developments" ON developments
  FOR SELECT TO authenticated USING (public.is_member(organization_id));
--> statement-breakpoint
CREATE POLICY "admins insert developments" ON developments
  FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins update developments" ON developments
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins delete developments" ON developments
  FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- units ----------------------------------------------------------------
CREATE POLICY "public reads units of published developments" ON units
  FOR SELECT TO anon, authenticated USING (public.development_is_published(development_id));
--> statement-breakpoint
CREATE POLICY "members read own units" ON units
  FOR SELECT TO authenticated USING (public.is_member(organization_id));
--> statement-breakpoint
CREATE POLICY "admins insert units" ON units
  FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins update units" ON units
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins delete units" ON units
  FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- properties -----------------------------------------------------------
CREATE POLICY "members read own properties" ON properties
  FOR SELECT TO authenticated USING (public.is_member(organization_id));
--> statement-breakpoint
CREATE POLICY "admins insert properties" ON properties
  FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins update properties" ON properties
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins delete properties" ON properties
  FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- leads: gestor vê todos da organização; corretor só os próprios ------------
CREATE POLICY "read visible leads" ON leads
  FOR SELECT TO authenticated
  USING (
    public.is_member(organization_id)
    AND (public.is_org_admin(organization_id) OR owner_id = auth.uid())
  );
--> statement-breakpoint
CREATE POLICY "create own or any lead as admin" ON leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (public.is_member(organization_id) AND owner_id = auth.uid())
  );
--> statement-breakpoint
CREATE POLICY "update visible leads" ON leads
  FOR UPDATE TO authenticated
  USING (
    public.is_member(organization_id)
    AND (public.is_org_admin(organization_id) OR owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (public.is_member(organization_id) AND owner_id = auth.uid())
  );
--> statement-breakpoint
CREATE POLICY "admins delete leads" ON leads
  FOR DELETE TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- lead_events: segue a visibilidade do lead; só inserção (histórico não se altera) ----
CREATE POLICY "read events of visible leads" ON lead_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_events.lead_id));
--> statement-breakpoint
CREATE POLICY "add events to visible leads" ON lead_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_events.lead_id AND l.organization_id = lead_events.organization_id
    )
  );
