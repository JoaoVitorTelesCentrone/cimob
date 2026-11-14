-- Gestor (ou a Center One) cancela convite ainda não aceito. Convite aceito já virou acesso:
-- para tirar alguém, desative o membro na equipe.
CREATE FUNCTION public.cancel_invitation(p_invitation uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM invitations
   WHERE id = p_invitation AND accepted_at IS NULL AND auth.uid() IS NOT NULL
     AND (public.is_platform_admin() OR public.is_org_admin(organization_id));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not allowed to cancel this invitation' USING ERRCODE = '42501';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.cancel_invitation(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cancel_invitation(uuid) TO authenticated, service_role;
