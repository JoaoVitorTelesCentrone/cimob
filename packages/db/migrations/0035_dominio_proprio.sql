-- Domínio próprio da imobiliária: só a Center One define (como o número do bot). Vazio tira o
-- domínio. Recusa formato inválido e domínio da plataforma (c1imob.com.br e localhost), que o
-- proxy nunca trata como domínio próprio (mesma lista de DEFAULT_ROOT_DOMAINS em lib/tenant/host.ts).
-- Domínio repetido é recusado pelo índice único de organizations.custom_domain.
CREATE FUNCTION public.set_custom_domain(p_org uuid, p_domain text)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d text := lower(btrim(coalesce(p_domain, '')));
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not allowed to set custom domain' USING ERRCODE = '42501';
  END IF;
  IF d = '' THEN
    UPDATE organizations SET custom_domain = NULL WHERE id = p_org;
    RETURN;
  END IF;
  IF d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
     OR length(d) > 253
     OR d = 'c1imob.com.br' OR d LIKE '%.c1imob.com.br'
     OR d = 'localhost' OR d LIKE '%.localhost' THEN
    RAISE EXCEPTION 'invalid domain' USING ERRCODE = '22023';
  END IF;
  UPDATE organizations SET custom_domain = d WHERE id = p_org;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.set_custom_domain(uuid, text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.set_custom_domain(uuid, text) TO authenticated, service_role;
