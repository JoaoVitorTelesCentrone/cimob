# language: pt
@crm
Funcionalidade: Rodízio de leads entre corretores
  Lead novo vai para o próximo corretor da vez, sem favorecer ninguém.
  A ordem é a dos nomes; a imobiliária guarda quem recebeu por último.

  Contexto:
    Dado a imobiliária "Horizonte" com a gestora "Paula"
    E os corretores no rodízio "Marina", "Rafael" e "Sofia"

  Cenário: Distribui em ordem e volta ao começo
    Quando chegam os leads "L1", "L2", "L3" e "L4"
    Então os donos são "Marina", "Rafael", "Sofia" e "Marina"

  Cenário: Quem sai do rodízio não recebe e a vez segue
    Dado o lead "L1" foi distribuído
    E a gestora tira "Rafael" do rodízio
    Quando chegam os leads "L2", "L3" e "L4"
    Então os donos são "Sofia", "Marina" e "Sofia"

  Cenário: Corretor desativado não recebe
    Dado "Marina" foi desativada
    Quando chegam os leads "L1", "L2" e "L3"
    Então os donos são "Rafael", "Sofia" e "Rafael"

  Cenário: Nenhum corretor no rodízio deixa o lead sem dono
    Dado a gestora tira "Marina", "Rafael" e "Sofia" do rodízio
    Quando chega o lead "L1"
    Então "L1" fica sem dono

  Cenário: Distribuir registra o horário e o histórico
    Quando chega o lead "L1"
    Então "L1" tem horário de atribuição e nenhuma resposta ainda
    E "L1" tem o evento "assigned" para "Marina" pelo rodízio

  Cenário: Lead que já tem dono não é redistribuído
    Dado o lead "L1" já é de "Sofia"
    Quando a gestora aciona o rodízio para "L1"
    Então "L1" continua com "Sofia"
    E a próxima da vez continua sendo "Marina"

  Cenário: Gestora vê quem é o próximo da vez
    Dado o lead "L1" foi distribuído
    Então a gestora vê "Rafael" como próximo da vez
    E "Rafael" não vê quem é o próximo da vez

  Cenário: Gestora aciona o rodízio pelo CRM
    Dado o lead "L1" sem dono
    Quando a gestora aciona o rodízio para "L1"
    Então "L1" fica com "Marina"

  Cenário: Corretor não aciona o rodízio
    Dado o lead "L1" sem dono
    Quando "Rafael" tenta acionar o rodízio para "L1"
    Então o banco recusa
    E "L1" fica sem dono

  Cenário: Visitante anônimo não aciona o rodízio nem vê o próximo da vez
    Dado o lead "L1" sem dono
    Quando um visitante anônimo tenta acionar o rodízio para "L1" e ver o próximo da vez
    Então o acesso é negado nas duas
    E "L1" fica sem dono

  Cenário: Gestora de outra imobiliária não aciona o rodízio
    Dado a imobiliária "Concorrente" com a gestora "Olga"
    E o lead "L1" sem dono
    Quando "Olga" tenta acionar o rodízio para "L1"
    Então o banco recusa
    E "L1" fica sem dono

  Cenário: Gestora tira e põe corretor no rodízio
    Quando a gestora tira "Rafael" do rodízio
    Então "Rafael" está fora do rodízio
    Quando a gestora põe "Rafael" no rodízio
    Então "Rafael" está no rodízio

  Cenário: Corretor não muda o próprio rodízio
    Quando "Rafael" tenta sair do rodízio
    Então "Rafael" está no rodízio

  Cenário: Gestora não muda outros dados da equipe pelo app
    Quando a gestora tenta mudar o papel de "Rafael" para "org_admin"
    Então o banco recusa
