-- O WhatsApp do corretor é só dígitos com DDI (ex.: 5511911110000).
ALTER TABLE memberships ADD CONSTRAINT memberships_whatsapp_digits
  CHECK (whatsapp IS NULL OR whatsapp ~ '^[1-9][0-9]{9,14}$');
--> statement-breakpoint

-- O gestor edita o WhatsApp da equipe pelo app (mesma policy do rodízio, só mais esta coluna).
GRANT UPDATE (whatsapp) ON memberships TO authenticated;
--> statement-breakpoint

-- Conversa com corretor aponta para o usuário (se ele sair, a conversa fica sem vínculo).
ALTER TABLE conversations ADD CONSTRAINT conversations_agent_user_fk
  FOREIGN KEY (agent_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
