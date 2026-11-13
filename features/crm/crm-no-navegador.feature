# language: pt
@crm @e2e
Funcionalidade: CRM no navegador
  O caminho real: link mágico, telas, permissões e mudanças ao vivo entre duas pessoas.
  Cada cenário usa uma imobiliária de teste própria, apagada no fim.

  Contexto:
    Dado uma imobiliária de teste com a gestora "Paula" e a corretora "Marina"

  @smoke
  Cenário: Entrar pelo link mágico abre o painel
    Quando "Paula" entra pelo link mágico
    Então "Paula" vê o título "Painel"

  Cenário: Lead atrasado aparece no alerta do painel
    Dado o lead "Ana Ribeiro" atribuído a "Marina" há 3 horas sem resposta
    Quando "Paula" abre "/app"
    Então "Paula" vê o alerta "1 lead sem primeira resposta há mais de 2 h: Ana Ribeiro"

  Cenário: Gestora coloca a corretora no rodízio e distribui um lead pela ficha
    Dado o lead "Bruno Lima" sem dono
    Quando "Paula" coloca "Marina" no rodízio
    E "Paula" distribui "Bruno Lima" pelo rodízio
    Então a ficha de "Bruno Lima" mostra a corretora "Marina"

  Cenário: Corretora não vê os controles de gestão
    Quando "Marina" abre "/app/equipe"
    Então "Marina" não vê botões de rodízio

  Cenário: Perder um lead no funil pede o motivo
    Dado o lead "Carla Souza" de "Marina" no estágio "contacted"
    Quando "Paula" arrasta "Carla Souza" para a coluna "Perdido"
    Então "Paula" vê o pedido de motivo da perda
    Quando "Paula" informa o motivo "Comprou com outra imobiliária"
    Então "Carla Souza" fica na coluna "Perdido" depois de recarregar

  Cenário: Mudança de status aparece ao vivo para outra pessoa
    Dado a unidade "E2E-101" disponível
    E "Marina" está vendo "/app/imoveis" ao vivo
    Quando "Paula" marca a unidade "E2E-101" como "Reservado"
    Então "Marina" vê a unidade "E2E-101" como "Reservado" sem recarregar

  Cenário: Lead movido por outra pessoa aparece no funil sem recarregar
    Dado o lead "Diego Alves" de "Marina" no estágio "new"
    E "Paula" está vendo "/app/funil" ao vivo
    Quando o lead "Diego Alves" vai para "qualified" por fora
    Então "Paula" vê "Diego Alves" na coluna "Qualificado" sem recarregar

  Cenário: Gestora exporta os dados de um lead (LGPD)
    Dado o lead "Diego Alves" de "Marina" no estágio "contacted"
    Quando "Paula" exporta os dados de "Diego Alves" pela ficha
    Então baixa um arquivo JSON com o nome "Diego Alves"

  Cenário: Gestora exclui os dados de um lead (LGPD) depois de confirmar
    Dado o lead "Érica Nunes" de "Marina" no estágio "qualified"
    Quando "Paula" pede para excluir os dados de "Érica Nunes" pela ficha
    Então "Paula" vê o aviso de que a exclusão não pode ser desfeita
    Quando "Paula" confirma a exclusão
    Então "Paula" vê a mensagem "Dados do lead excluídos"
    E "Érica Nunes" não aparece mais na lista de leads

  Cenário: Corretora não exporta nem exclui dados de lead
    Dado o lead "Felipe Prado" de "Marina" no estágio "contacted"
    Quando "Marina" abre a ficha de "Felipe Prado"
    Então "Marina" não vê as ações de dados do lead

  Cenário: Center One cria uma imobiliária e o gestor entra pelo convite
    Dado o admin da plataforma "Carlos"
    Quando "Carlos" cria a imobiliária "Lumen" com o gestor "Lia" pela tela da agência
    Então "Carlos" vê a mensagem "Imobiliária criada"
    Quando "Lia" entra pelo convite
    Então "Lia" vê o título "Painel"

  Cenário: Gestora convida um corretor, que entra pelo convite
    Quando "Paula" convida o corretor "Rafael" pela tela da equipe
    Então "Paula" vê "Rafael" nos convites pendentes
    Quando "Rafael" entra pelo convite
    Então "Rafael" vê o título "Painel"

  Cenário: Gestora muda o critério de qualificação
    Quando "Paula" muda o prazo máximo para "Até 3 meses" nas configurações
    Então "Paula" vê a mensagem "Critério salvo. Vale para os próximos leads."
    E o prazo máximo continua "Até 3 meses" depois de recarregar

  Cenário: Corretora não muda as configurações
    Quando "Marina" abre "/app/config"
    Então "Marina" vê a mensagem "Só o gestor da imobiliária muda as configurações."
