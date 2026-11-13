# language: pt
@seguranca
Funcionalidade: Isolamento das organizações no banco
  Cada imobiliária (organização) só enxerga os próprios dados, garantido pelo banco (RLS).

  Contexto:
    Dado as organizações "Horizonte" e "Alfa"
    E "Marina" é gestora da "Horizonte"
    E "Rafael" é corretor da "Horizonte"
    E "Paulo" é gestor da "Alfa"

  Cenário: Usuário vê só a própria organização
    Quando "Marina" lista as organizações
    Então aparece "Horizonte"
    E não aparece "Alfa"

  Cenário: Usuário não vê os membros de outra organização
    Quando "Paulo" lista os membros
    Então aparecem apenas os membros da "Alfa"

  Cenário: Corretor não altera a organização
    Quando "Rafael" tenta renomear a "Horizonte" para "Outro nome"
    Então a alteração é negada
    E a "Horizonte" continua com o nome "Horizonte"

  Cenário: Gestor altera a própria organização
    Quando "Marina" tenta renomear a "Horizonte" para "Horizonte Imóveis"
    Então a "Horizonte" passa a se chamar "Horizonte Imóveis"

  Cenário: Gestor não altera outra organização
    Quando "Marina" tenta renomear a "Alfa" para "Invadida"
    Então a alteração é negada
    E a "Alfa" continua com o nome "Alfa"

  Cenário: Membro desativado perde o acesso
    Dado "Rafael" foi desativado na "Horizonte"
    Quando "Rafael" lista as organizações
    Então não aparece "Horizonte"

  Esquema do Cenário: Papel do usuário na organização
    Quando consulto o papel de "<usuário>" na "<organização>"
    Então o papel é "<papel>"

    Exemplos:
      | usuário | organização | papel     |
      | Marina  | Horizonte   | org_admin |
      | Rafael  | Horizonte   | agent     |
      | Paulo   | Horizonte   | nenhum    |

  Cenário: Visitante anônimo não lê organizações nem membros
    Quando um visitante anônimo lista as organizações
    Então nenhuma organização aparece
    E nenhum membro aparece
