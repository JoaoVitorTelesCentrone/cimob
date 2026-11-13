-- O Supabase concede EXECUTE ao anon direto (não só pelo PUBLIC), então "REVOKE ... FROM PUBLIC"
-- não bastava: o anônimo, sem usuário no JWT, passava por "sistema" nas funções SECURITY DEFINER
-- e conseguia acionar o rodízio. O anônimo só chama o que o site público usa.
REVOKE EXECUTE ON FUNCTION public.assign_lead_by_rotation(uuid), public.next_in_rotation(uuid),
  public.export_lead_data(uuid), public.delete_lead_data(uuid) FROM anon;
--> statement-breakpoint

-- Ajudante interno das funções de LGPD: ninguém chama direto (recebe uma linha de leads qualquer).
REVOKE EXECUTE ON FUNCTION public.lead_contact_conversations(leads) FROM anon, authenticated, service_role;
--> statement-breakpoint

-- Funções novas deixam de nascer com EXECUTE para o anon: cada uma concede o que precisar.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
