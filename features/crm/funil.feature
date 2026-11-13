# language: pt
@crm
Funcionalidade: Funil em kanban
  O gestor e o corretor arrastam o lead entre as etapas. Perder um lead exige dizer por quê.

  Contexto:
    Dado agora são "2026-11-12 15:00"
    E os leads do funil:
      | nome        | estágio   | atribuído às     | respondido |
      | Ana Ribeiro | new       | 2026-11-12 14:00 | não        |
      | Bruno Lima  | new       | 2026-11-12 10:00 | não        |
      | Carla Souza | contacted | 2026-11-12 09:00 | sim        |

  Cenário: As colunas seguem a ordem do funil e mostram a contagem
    Quando abro o funil
    Então as colunas são "Novo", "Qualificado", "Em atendimento", "Visita agendada", "Visita feita", "Proposta", "Ganho", "Perdido"
    E a coluna "Novo" tem 2 leads
    E a coluna "Em atendimento" tem 1 lead

  Cenário: Atrasados ficam no topo da coluna
    Quando abro o funil
    Então o primeiro da coluna "Novo" é "Bruno Lima"

  Cenário: Mover para outra etapa é aceito
    Quando arrasto "Ana Ribeiro" para "qualified"
    Então a mudança é aceita para "qualified"

  Cenário: Soltar na mesma coluna não muda nada
    Quando arrasto "Ana Ribeiro" para "new"
    Então nada é salvo

  Cenário: Mover para perdido sem motivo pede o motivo
    Quando arrasto "Carla Souza" para "lost" sem informar o motivo
    Então a mudança não é salva
    E vejo a mensagem "Informe o motivo da perda"

  Cenário: Mover para perdido com motivo é aceito
    Quando arrasto "Carla Souza" para "lost" com o motivo "  Sem retorno há 30 dias "
    Então a mudança é aceita para "lost" com o motivo "Sem retorno há 30 dias"

  Cenário: Motivo longo demais é recusado
    Quando arrasto "Carla Souza" para "lost" com um motivo de 301 caracteres
    Então vejo a mensagem "O motivo pode ter no máximo 300 caracteres"

  Cenário: Lead alterado por outra pessoa no meio do caminho
    Dado outra pessoa já moveu "Ana Ribeiro" para "contacted"
    Quando arrasto "Ana Ribeiro" de "new" para "qualified"
    Então vejo a mensagem "Este lead foi alterado por outra pessoa. Atualize a página."

  Cenário: Etapa inexistente é recusada
    Quando arrasto "Ana Ribeiro" para "arquivado"
    Então vejo a mensagem "Etapa inválida"
