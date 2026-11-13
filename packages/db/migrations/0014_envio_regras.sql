-- Mensagem de saída sempre tem estado de envio; mensagem recebida nunca tem.
-- Saídas gravadas antes desta regra (só em ambiente de teste) ficam como falha, para não serem enviadas fora de hora.
UPDATE messages SET send_status = 'failed', send_error = 'gravada antes do worker de envio'
  WHERE direction = 'outbound' AND send_status IS NULL;
--> statement-breakpoint
ALTER TABLE messages ADD CONSTRAINT messages_send_status_by_direction
  CHECK ((direction = 'outbound') = (send_status IS NOT NULL));
--> statement-breakpoint

-- Varredura do worker de envio: só as pendentes, em ordem, por conversa.
CREATE INDEX messages_pending_idx ON messages (conversation_id, created_at)
  WHERE send_status = 'pending';
