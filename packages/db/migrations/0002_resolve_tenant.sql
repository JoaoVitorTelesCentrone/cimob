-- Resolução pública do tenant (site do corretor). Devolve só dados públicos e só quando há uma chave exata.
-- security definer: o anônimo não tem policy de leitura em organizations.
CREATE FUNCTION public.resolve_tenant(p_slug text DEFAULT NULL, p_domain text DEFAULT NULL)
  RETURNS TABLE (id uuid, slug text, name text, brand jsonb)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.slug, o.name, o.brand
  FROM organizations o
  WHERE (p_slug IS NOT NULL AND o.slug = lower(p_slug))
     OR (p_domain IS NOT NULL AND o.custom_domain = lower(p_domain))
  LIMIT 1;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resolve_tenant(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_tenant(text, text) TO anon, authenticated, service_role;
