-- Leads já perdidos sem motivo (antes desta regra) recebem um motivo genérico.
UPDATE leads SET lost_reason = 'Não informado'
  WHERE stage = 'lost' AND (lost_reason IS NULL OR btrim(lost_reason) = '');
--> statement-breakpoint

-- Perdido sempre tem motivo, venha de onde vier a mudança (CRM, bot, script).
ALTER TABLE leads ADD CONSTRAINT leads_lost_requires_reason
  CHECK (stage <> 'lost' OR (lost_reason IS NOT NULL AND btrim(lost_reason) <> ''));
--> statement-breakpoint

-- Fora de "perdido" não existe motivo de perda (reabrir o lead apaga o motivo).
CREATE FUNCTION public.leads_normalize_lost_reason() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.stage <> 'lost' THEN
    NEW.lost_reason := NULL;
  ELSE
    NEW.lost_reason := btrim(NEW.lost_reason);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER leads_normalize_lost_reason
  BEFORE INSERT OR UPDATE OF stage, lost_reason ON leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_normalize_lost_reason();
--> statement-breakpoint

-- Toda mudança de estágio vira evento. security definer: o histórico é gravado mesmo quando
-- quem mudou não teria permissão direta de inserir em lead_events (ex.: service role do bot).
CREATE FUNCTION public.leads_log_stage_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_events (organization_id, lead_id, type, data, actor_id)
  VALUES (
    NEW.organization_id,
    NEW.id,
    'stage_changed',
    jsonb_strip_nulls(jsonb_build_object(
      'from', OLD.stage,
      'to', NEW.stage,
      'reason', CASE WHEN NEW.stage = 'lost' THEN NEW.lost_reason END
    )),
    auth.uid()
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.leads_log_stage_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER leads_log_stage_change
  AFTER UPDATE OF stage ON leads
  FOR EACH ROW WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION public.leads_log_stage_change();
