-- T4.3: entrada de imobiliária e da equipe. A Center One (platform_admins) cria a imobiliária e
-- cuida da parte técnica; o gestor convida/desativa a equipe e muda marca e critério.

ALTER TABLE organizations ADD CONSTRAINT organizations_qualify_timeframe_check
  CHECK (qualify_timeframe IN ('3m', '6m', 'any'));
--> statement-breakpoint
ALTER TABLE organizations ADD CONSTRAINT organizations_qualify_price_share_check
  CHECK (qualify_price_share BETWEEN 0.50 AND 1.00);
--> statement-breakpoint
ALTER TABLE invitations ADD CONSTRAINT invitations_email_check
  CHECK (email = lower(btrim(email)) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
--> statement-breakpoint
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('org_admin', 'agent'));
--> statement-breakpoint
ALTER TABLE invitations ADD CONSTRAINT invitations_whatsapp_check
  CHECK (whatsapp IS NULL OR whatsapp ~ '^[1-9][0-9]{9,14}$');
--> statement-breakpoint

-- Brecha: o gestor podia mudar qualquer coluna da organização (endereço, domínio, plano, is_demo).
-- Pelo app ele muda só a marca e o critério; o resto é da Center One (funções abaixo ou service role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON organizations FROM authenticated, anon;
--> statement-breakpoint
GRANT UPDATE (brand, qualify_timeframe, qualify_price_share) ON organizations TO authenticated;
--> statement-breakpoint

-- Admins da plataforma: ninguém lê nem grava pelo app; só a função abaixo responde "sou eu?".
REVOKE ALL ON platform_admins FROM anon, authenticated;
--> statement-breakpoint
CREATE FUNCTION public.is_platform_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
--> statement-breakpoint

-- Convites: o gestor vê os da própria imobiliária; grava só pelas funções.
REVOKE ALL ON invitations FROM anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON invitations FROM authenticated;
--> statement-breakpoint
CREATE POLICY "admins read own invitations" ON invitations
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

CREATE FUNCTION public.invite_member(p_org uuid, p_email text, p_role membership_role,
                                     p_name text, p_whatsapp text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_platform_admin() OR public.is_org_admin(p_org)) THEN
    RAISE EXCEPTION 'not allowed to invite here' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('org_admin', 'agent') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'name required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM memberships m JOIN auth.users u ON u.id = m.user_id
             WHERE m.organization_id = p_org AND lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'already a member' USING ERRCODE = '23505';
  END IF;

  INSERT INTO invitations (organization_id, email, role, display_name, whatsapp, invited_by)
  VALUES (p_org, v_email, p_role, btrim(p_name), nullif(btrim(coalesce(p_whatsapp, '')), ''), auth.uid())
  ON CONFLICT (organization_id, email) DO UPDATE
    SET role = excluded.role, display_name = excluded.display_name, whatsapp = excluded.whatsapp,
        invited_by = excluded.invited_by, created_at = now()
    WHERE invitations.accepted_at IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'already a member' USING ERRCODE = '23505';
  END IF;
  RETURN v_id;
END;
$$;
--> statement-breakpoint

-- Endereço: minúsculas, números e hífen (sem começar/terminar com hífen) e fora das rotas da plataforma.
CREATE FUNCTION public.create_organization(p_name text, p_slug text, p_admin_email text,
                                           p_admin_name text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not allowed to create organizations' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'name required' USING ERRCODE = '22023';
  END IF;
  IF p_slug !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'
     OR p_slug IN ('app', 'login', 'auth', 'api', 'www', 'dev', 'admin', 'static', 'assets',
                   'site', 'mail', 'center-one', 'c1imob') THEN
    RAISE EXCEPTION 'invalid or reserved slug' USING ERRCODE = '22023';
  END IF;

  INSERT INTO organizations (name, slug) VALUES (btrim(p_name), p_slug) RETURNING id INTO v_org;
  -- Quem criou entra como agência: configura a parte técnica e acompanha a imobiliária.
  INSERT INTO memberships (organization_id, user_id, role, display_name)
  VALUES (v_org, auth.uid(), 'agency_admin', 'Center One');
  PERFORM public.invite_member(v_org, p_admin_email, 'org_admin', p_admin_name, NULL);
  RETURN v_org;
END;
$$;
--> statement-breakpoint

-- 1ª entrada: os convites do e-mail da conta (lido do Auth, não do JWT) viram membership.
CREATE FUNCTION public.accept_my_invitations() RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  inv invitations%ROWTYPE;
  n integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  FOR inv IN SELECT * FROM invitations WHERE email = v_email AND accepted_at IS NULL FOR UPDATE LOOP
    INSERT INTO memberships (organization_id, user_id, role, display_name, whatsapp)
    VALUES (inv.organization_id, v_uid, inv.role, inv.display_name,
            -- WhatsApp já usado por outro membro da imobiliária fica vazio (o gestor corrige na equipe).
            CASE WHEN EXISTS (SELECT 1 FROM memberships WHERE organization_id = inv.organization_id
                                                         AND whatsapp = inv.whatsapp)
                 THEN NULL ELSE inv.whatsapp END)
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET active = true, role = excluded.role, display_name = excluded.display_name;
    UPDATE invitations SET accepted_by = v_uid, accepted_at = now() WHERE id = inv.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
--> statement-breakpoint

-- Gestor desativa ou reativa alguém da equipe (nunca a si mesmo nem a agência). Quem sai, sai do rodízio.
CREATE FUNCTION public.set_member_active(p_org uuid, p_user uuid, p_active boolean) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_admin(p_org) OR p_user = auth.uid() THEN
    RAISE EXCEPTION 'not allowed to change this member' USING ERRCODE = '42501';
  END IF;
  UPDATE memberships
     SET active = p_active, in_rotation = CASE WHEN p_active THEN in_rotation ELSE false END
   WHERE organization_id = p_org AND user_id = p_user AND role <> 'agency_admin';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not allowed to change this member' USING ERRCODE = '42501';
  END IF;
END;
$$;
--> statement-breakpoint

-- Parte técnica (só a Center One). O token vai para o Vault; trocar o número mantém o token.
CREATE FUNCTION public.set_whatsapp_account(p_org uuid, p_phone_number_id text, p_token text)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  acc whatsapp_accounts%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not allowed to configure whatsapp' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_phone_number_id, '')) = '' THEN
    RAISE EXCEPTION 'phone_number_id required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO acc FROM whatsapp_accounts WHERE organization_id = p_org ORDER BY id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO whatsapp_accounts (organization_id, phone_number_id)
    VALUES (p_org, btrim(p_phone_number_id)) RETURNING * INTO acc;
  ELSE
    UPDATE whatsapp_accounts SET phone_number_id = btrim(p_phone_number_id) WHERE id = acc.id;
  END IF;
  IF btrim(coalesce(p_token, '')) <> '' THEN
    IF acc.token_secret_id IS NULL THEN
      UPDATE whatsapp_accounts
         SET token_secret_id = vault.create_secret(btrim(p_token), 'wa-token-' || acc.id::text)
       WHERE id = acc.id;
    ELSE
      PERFORM vault.update_secret(acc.token_secret_id, btrim(p_token));
    END IF;
  END IF;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.set_meta_ads_account(p_org uuid, p_ad_account_id text, p_token text)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  acc meta_ads_accounts%ROWTYPE;
  v_act text := 'act_' || regexp_replace(btrim(coalesce(p_ad_account_id, '')), '^act_', '');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not allowed to configure ads' USING ERRCODE = '42501';
  END IF;
  IF v_act !~ '^act_[0-9]+$' THEN
    RAISE EXCEPTION 'invalid ad account' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO acc FROM meta_ads_accounts WHERE organization_id = p_org ORDER BY id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO meta_ads_accounts (organization_id, ad_account_id) VALUES (p_org, v_act)
    RETURNING * INTO acc;
  ELSE
    UPDATE meta_ads_accounts SET ad_account_id = v_act WHERE id = acc.id;
  END IF;
  IF btrim(coalesce(p_token, '')) <> '' THEN
    IF acc.token_secret_id IS NULL THEN
      UPDATE meta_ads_accounts
         SET token_secret_id = vault.create_secret(btrim(p_token), 'ads-token-' || acc.id::text)
       WHERE id = acc.id;
    ELSE
      PERFORM vault.update_secret(acc.token_secret_id, btrim(p_token));
    END IF;
  END IF;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.invite_member(uuid, text, membership_role, text, text),
  public.create_organization(text, text, text, text), public.accept_my_invitations(),
  public.set_member_active(uuid, uuid, boolean), public.set_whatsapp_account(uuid, text, text),
  public.set_meta_ads_account(uuid, text, text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.invite_member(uuid, text, membership_role, text, text),
  public.create_organization(text, text, text, text), public.accept_my_invitations(),
  public.set_member_active(uuid, uuid, boolean), public.set_whatsapp_account(uuid, text, text),
  public.set_meta_ads_account(uuid, text, text) TO authenticated, service_role;
