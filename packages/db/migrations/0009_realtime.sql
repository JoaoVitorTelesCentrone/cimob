-- Realtime (doc 06): funil, lista de leads e estoque se atualizam sozinhos.
-- O Realtime aplica o RLS de SELECT de cada usuário: ninguém recebe linha que não poderia ler.
-- Equipe e organização ficam de fora (não há tela que precise delas ao vivo).
ALTER PUBLICATION supabase_realtime ADD TABLE leads, lead_events, units, properties;
