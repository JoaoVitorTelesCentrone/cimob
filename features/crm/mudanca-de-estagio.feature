# language: pt
@crm
Funcionalidade: Mudança de estágio registrada no banco
  Toda mudança de estágio vira histórico, venha do CRM ou do bot. Perdido sempre tem motivo.

  Contexto:
    Dado a imobiliária "Horizonte" com o corretor "Marina"
    E o lead "Ana" de "Marina" no estágio "contacted"

  Cenário: Mudar o estágio gera um evento com origem, destino e autor
    Quando "Marina" move "Ana" para "visit_scheduled"
    Então "Ana" tem 1 evento "stage_changed" de "contacted" para "visit_scheduled" feito por "Marina"

  Cenário: Perdido sem motivo é recusado
    Quando "Marina" move "Ana" para "lost" sem motivo
    Então o banco recusa a mudança
    E "Ana" continua no estágio "contacted"

  Cenário: Perdido com motivo é aceito e o motivo vai para o histórico
    Quando "Marina" move "Ana" para "lost" com o motivo "Comprou com outra imobiliária"
    Então "Ana" está no estágio "lost" com o motivo "Comprou com outra imobiliária"
    E o evento de "Ana" registra o motivo "Comprou com outra imobiliária"

  Cenário: Reabrir um lead perdido apaga o motivo
    Dado "Ana" foi perdida com o motivo "Sem retorno"
    Quando "Marina" move "Ana" para "contacted"
    Então "Ana" está no estágio "contacted" sem motivo de perda

  Cenário: Alterar outro campo não gera evento de estágio
    Quando "Marina" altera o prazo de "Ana" para "3 meses"
    Então "Ana" não tem eventos "stage_changed"
