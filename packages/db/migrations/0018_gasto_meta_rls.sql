-- Investimento em anúncios é dado sensível da imobiliária: o anônimo nem chega às tabelas.
REVOKE ALL ON "ad_spend_daily", "meta_ads_accounts" FROM anon;
--> statement-breakpoint

-- Pelo app ninguém grava gasto nem conta de anúncios; quem grava é o apps/bot (service role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "ad_spend_daily", "meta_ads_accounts" FROM authenticated;
--> statement-breakpoint

-- Só o gestor (org_admin/agency_admin) lê o gasto e a conta de anúncios da própria imobiliária.
CREATE POLICY "admins read own ad spend" ON ad_spend_daily
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint
CREATE POLICY "admins read own meta ads accounts" ON meta_ads_accounts
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
