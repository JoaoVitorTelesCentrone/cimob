# language: pt
@crm
Funcionalidade: Mudanças em tempo real
  Funil, lista de leads e estoque se atualizam sozinhos quando outra pessoa muda algo.
  O Realtime respeita o RLS: cada um só recebe o que já poderia ler.

  Cenário: Leads e estoque são publicados em tempo real
    Então o banco publica em tempo real "leads", "lead_events", "units" e "properties"

  Cenário: Equipe e organização não são publicadas
    Então o banco não publica em tempo real "memberships" nem "organizations"
