# language: pt
@crm
Funcionalidade: Alerta de lead sem resposta

  Cenário: Lead atribuído há mais de 2 horas sem resposta aparece como atrasado
    Dado o lead "Ana Ribeiro" atribuído a "Marina Alves" há 3 horas
    E "Marina Alves" ainda não respondeu
    Quando o gestor abre o painel
    Então o painel mostra o alerta "1 lead sem primeira resposta há mais de 2 h"
    E "Ana Ribeiro" aparece primeiro na lista de leads

  Cenário: Resposta do corretor remove o alerta
    Dado o lead "Ana Ribeiro" atrasado
    Quando "Marina Alves" responde "1" à pergunta de estágio
    Então o lead deixa de estar atrasado
    E o tempo de primeira resposta é registrado

  Cenário: Marcar como perdido exige motivo
    Dado o lead "Bruno Lima" no estágio "em atendimento"
    Quando o corretor move o lead para "perdido" sem informar motivo
    Então a mudança não é salva
    E o sistema pede o motivo da perda
