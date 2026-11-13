-- T4.5: importação de tabela de preços em PDF. Rascunho → revisão → publicar (ou descartar).
-- O gestor lê o rascunho da própria imobiliária; só as funções gravam.

ALTER TABLE unit_imports ADD CONSTRAINT unit_imports_development_fk
  FOREIGN KEY (organization_id, development_id)
  REFERENCES developments (organization_id, id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE unit_imports ADD CONSTRAINT unit_imports_status_check
  CHECK (status IN ('draft', 'published', 'discarded'));
--> statement-breakpoint
CREATE INDEX unit_import_rows_import_idx ON unit_import_rows (import_id, position);
--> statement-breakpoint

REVOKE ALL ON unit_imports, unit_import_rows FROM anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON unit_imports, unit_import_rows FROM authenticated;
--> statement-breakpoint
CREATE POLICY "admins read own imports" ON unit_imports
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins read own import rows" ON unit_import_rows
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- Grava o rascunho com as linhas que o services/ingest extraiu.
CREATE FUNCTION public.create_unit_import(p_development uuid, p_file_name text, p_rows jsonb,
                                          p_warnings jsonb) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  dev developments%ROWTYPE;
  v_import uuid;
BEGIN
  SELECT * INTO dev FROM developments WHERE id = p_development;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_org_admin(dev.organization_id) THEN
    RAISE EXCEPTION 'not allowed to import here' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'no rows to import' USING ERRCODE = '22023';
  END IF;

  INSERT INTO unit_imports (organization_id, development_id, file_name, warnings, created_by, is_demo)
  VALUES (dev.organization_id, dev.id, left(btrim(p_file_name), 200),
          coalesce(p_warnings, '[]'::jsonb), auth.uid(), dev.is_demo)
  RETURNING id INTO v_import;

  INSERT INTO unit_import_rows (organization_id, import_id, position, code, floor, area_m2, bedrooms,
                                parking, price, status, needs_review, issues)
  SELECT dev.organization_id, v_import, r.ordinality::int, btrim(r.value->>'code'),
         (r.value->>'floor')::int, (r.value->>'area_m2')::numeric, (r.value->>'bedrooms')::int,
         (r.value->>'parking')::int, (r.value->>'price')::numeric,
         (r.value->>'status')::unit_status, coalesce((r.value->>'needs_review')::boolean, false),
         coalesce(r.value->'issues', '[]'::jsonb)
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS r(value, ordinality)
  WHERE btrim(coalesce(r.value->>'code', '')) <> '';
  RETURN v_import;
END;
$$;
--> statement-breakpoint

-- Publica: atualiza as unidades com o mesmo código e cria as novas; nunca apaga. Campo que o PDF
-- não deixou ler (nulo) não sobrescreve o que já existe. Unidade nova sem situação legível entra
-- como reservada: o bot nunca oferece como disponível o que não está claro.
CREATE FUNCTION public.publish_unit_import(p_import uuid) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  imp unit_imports%ROWTYPE;
  r unit_import_rows%ROWTYPE;
  existing units%ROWTYPE;
  n integer := 0;
BEGIN
  SELECT * INTO imp FROM unit_imports WHERE id = p_import FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_org_admin(imp.organization_id) THEN
    RAISE EXCEPTION 'not allowed to publish this import' USING ERRCODE = '42501';
  END IF;
  IF imp.status <> 'draft' THEN
    RAISE EXCEPTION 'import already %', imp.status USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT * FROM unit_import_rows WHERE import_id = imp.id ORDER BY position LOOP
    SELECT * INTO existing FROM units
     WHERE organization_id = imp.organization_id AND code = r.code FOR UPDATE;
    IF FOUND AND existing.development_id <> imp.development_id THEN
      RAISE EXCEPTION 'unit % belongs to another development', r.code USING ERRCODE = '23505';
    ELSIF FOUND THEN
      UPDATE units SET
        floor = coalesce(r.floor, floor),
        area_m2 = coalesce(r.area_m2, area_m2),
        bedrooms = coalesce(r.bedrooms, bedrooms),
        parking = coalesce(r.parking, parking),
        price = coalesce(r.price, price),
        status = coalesce(r.status, status)
      WHERE id = existing.id;
    ELSE
      INSERT INTO units (organization_id, development_id, code, floor, area_m2, bedrooms, parking,
                         price, status, is_demo)
      VALUES (imp.organization_id, imp.development_id, r.code, r.floor, r.area_m2, r.bedrooms,
              r.parking, r.price, coalesce(r.status, 'reserved'), imp.is_demo);
    END IF;
    n := n + 1;
  END LOOP;

  UPDATE unit_imports SET status = 'published', published_by = auth.uid(), published_at = now()
   WHERE id = imp.id;
  RETURN n;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION public.discard_unit_import(p_import uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE unit_imports SET status = 'discarded'
   WHERE id = p_import AND status = 'draft'
     AND auth.uid() IS NOT NULL AND public.is_org_admin(organization_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not allowed to discard this import' USING ERRCODE = '42501';
  END IF;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.create_unit_import(uuid, text, jsonb, jsonb),
  public.publish_unit_import(uuid), public.discard_unit_import(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_unit_import(uuid, text, jsonb, jsonb),
  public.publish_unit_import(uuid), public.discard_unit_import(uuid) TO authenticated, service_role;
