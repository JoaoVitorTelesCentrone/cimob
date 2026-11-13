-- Membros pertencem a usuários do Supabase Auth.
ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;
--> statement-breakpoint

-- security definer: consultam memberships sem recursão de RLS. search_path fixo por segurança.
CREATE FUNCTION public.is_member(org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = org AND user_id = auth.uid() AND active
  );
$$;
--> statement-breakpoint

CREATE FUNCTION public.role_in(org uuid) RETURNS membership_role
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM memberships
  WHERE organization_id = org AND user_id = auth.uid() AND active;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.is_member(uuid), public.role_in(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_member(uuid), public.role_in(uuid) TO authenticated, service_role;
--> statement-breakpoint

-- organizations: membro ativo lê; gestor (org_admin/agency_admin) altera a própria. Sem insert/delete para clientes.
CREATE POLICY "members read own organization" ON organizations
  FOR SELECT TO authenticated
  USING (public.is_member(id));
--> statement-breakpoint
CREATE POLICY "admins update own organization" ON organizations
  FOR UPDATE TO authenticated
  USING (public.role_in(id) IN ('org_admin', 'agency_admin'))
  WITH CHECK (public.role_in(id) IN ('org_admin', 'agency_admin'));
--> statement-breakpoint

-- memberships: cada um vê a própria linha; gestores veem toda a equipe da organização. Escrita só pela service role.
CREATE POLICY "see own membership or team as admin" ON memberships
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND active)
    OR public.role_in(organization_id) IN ('org_admin', 'agency_admin')
  );
