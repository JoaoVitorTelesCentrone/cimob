-- Dados do bot (doc 03/04). Quem grava é o apps/bot, como sistema (conexão direta, fora do RLS),
-- sempre com o organization_id resolvido pelo phone_number_id. Pelo app, só leitura.

-- Anônimo não chega perto; usuário logado não grava nada por aqui.
REVOKE ALL ON "whatsapp_accounts", "conversations", "messages", "consents" FROM anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "whatsapp_accounts", "conversations", "messages", "consents" FROM authenticated;
--> statement-breakpoint

-- Número de WhatsApp: só o gestor da imobiliária vê (é configuração, não atendimento).
CREATE POLICY "admins read own whatsapp accounts" ON whatsapp_accounts
  FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
--> statement-breakpoint

-- Conversa: o gestor vê todas da imobiliária; o corretor, só as dos leads que ele já vê.
-- A subconsulta em leads passa pelo RLS de leads, então a regra do corretor não se repete aqui.
CREATE POLICY "read conversations of visible leads" ON conversations
  FOR SELECT TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM leads l WHERE l.id = conversations.lead_id))
  );
--> statement-breakpoint

-- Mensagens e consentimentos seguem a conversa (que já segue o lead).
CREATE POLICY "read messages of visible conversations" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id));
--> statement-breakpoint
CREATE POLICY "read consents of visible conversations" ON consents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = consents.conversation_id));
