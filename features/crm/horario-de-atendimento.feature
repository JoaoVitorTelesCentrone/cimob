# language: pt
@crm
Funcionalidade: Horário de atendimento
  O gestor define os dias e o horário em que a equipe atende (hora de Brasília). O alerta de
  lead sem primeira resposta conta só o tempo dentro desse horário: lead que chega fora do
  expediente não fica atrasado antes de a equipe ter tido 2 horas de trabalho para responder.
  Sem horário definido, conta o tempo corrido, como antes.

  Esquema do Cenário: O atraso conta só o tempo dentro do horário
    Dado a imobiliária atende de segunda a sexta, das 09:00 às 18:00
    E o lead "Ana Ribeiro" atribuído a "Marina Alves" <atribuído>
    Quando o gestor abre o painel <agora>
    Então "Ana Ribeiro" <situação> atrasado

    Exemplos:
      | atribuído          | agora               | situação |
      | na sexta às 22:00  | no sábado às 15:00  | não está |
      | na sexta às 22:00  | na segunda às 11:00 | não está |
      | na sexta às 22:00  | na segunda às 11:01 | está     |
      | na sexta às 17:00  | na segunda às 10:00 | não está |
      | na sexta às 17:00  | na segunda às 10:01 | está     |
      | na quarta às 10:00 | na quarta às 12:01  | está     |

  Cenário: Fora do horário o painel não mostra alerta
    Dado a imobiliária atende de segunda a sexta, das 09:00 às 18:00
    E o lead "Ana Ribeiro" atribuído a "Marina Alves" na sexta às 22:00
    Quando o gestor abre o painel no sábado às 15:00
    Então o painel não mostra alerta de atraso

  Cenário: Sem horário definido, conta o tempo corrido
    Dado a imobiliária não definiu horário de atendimento
    E o lead "Ana Ribeiro" atribuído a "Marina Alves" na sexta às 22:00
    Quando o gestor abre o painel no sábado às 00:01
    Então "Ana Ribeiro" está atrasado

  Cenário: Horário com fechamento antes da abertura é recusado
    Quando o gestor tenta salvar o horário de segunda a sexta, das 18:00 às 09:00
    Então o sistema recusa com "O fechamento precisa ser depois da abertura."

  Cenário: Horário sem nenhum dia é recusado
    Quando o gestor tenta salvar o horário sem nenhum dia, das 09:00 às 18:00
    Então o sistema recusa com "Escolha ao menos um dia."
