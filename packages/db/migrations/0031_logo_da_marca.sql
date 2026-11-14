-- Logo da imobiliária (marca). Bucket público: o site mostra para qualquer visitante. Só o gestor
-- da imobiliária grava, e só na pasta com o id dela ("<organization_id>/logo.png"). Sem SVG
-- (pode carregar script); até 1 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand', 'brand', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Pasta = id de uma imobiliária que a pessoa administra. O CASE garante que o texto só vira uuid
-- depois de conferido (pasta qualquer não quebra a consulta: só é recusada).
CREATE FUNCTION public.can_write_brand_path(path text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_org_admin(split_part(path, '/', 1)::uuid)
    ELSE false
  END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.can_write_brand_path(text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.can_write_brand_path(text) TO authenticated, service_role;
--> statement-breakpoint

CREATE POLICY "admins add own brand files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand' AND public.can_write_brand_path(name));
--> statement-breakpoint
CREATE POLICY "admins replace own brand files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'brand' AND public.can_write_brand_path(name))
  WITH CHECK (bucket_id = 'brand' AND public.can_write_brand_path(name));
--> statement-breakpoint
CREATE POLICY "admins remove own brand files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'brand' AND public.can_write_brand_path(name));
--> statement-breakpoint
-- Ler pela API (upsert confere se o arquivo existe): o gestor vê os arquivos da própria pasta.
CREATE POLICY "admins read own brand files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'brand' AND public.can_write_brand_path(name));
