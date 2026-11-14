# language: pt
@crm
Funcionalidade: Ficha do lead: 1ª resposta, próximo passo e visita
  O corretor dono (ou o gestor) registra na ficha a 1ª resposta, o próximo passo com data e a
  data da visita. Cada ação fica no histórico com quem fez. A hora da 1ª resposta é a do
  servidor: ninguém ajusta pelo app o próprio tempo de resposta.

  Contexto:
    Dado a imobiliária "Horizonte" com a gestora "Paula" e os corretores "Marina" e "Rafael"
    E o lead "Ana Ribeiro" atribuído a "Marina" há 3 horas, no estágio "qualified"

  Cenário: Corretora registra a 1ª resposta com a hora do servidor
    Quando "Marina" registra a 1ª resposta de "Ana Ribeiro"
    Então "Ana Ribeiro" tem a 1ª resposta registrada agora
    E o histórico de "Ana Ribeiro" tem "first_response" feito por "Marina"
    Quando "Marina" registra a 1ª resposta de "Ana Ribeiro" de novo
    Então a 1ª resposta de "Ana Ribeiro" não muda

  Cenário: Corretora não ajusta horários nem dono pelo app
    Quando "Marina" tenta mudar a 1ª resposta, a atribuição e o dono de "Ana Ribeiro"
    Então o banco recusa nas três

  Cenário: Corretora define o próximo passo com data
    Quando "Marina" define o próximo passo de "Ana Ribeiro" como "Ligar para confirmar a visita" para "2026-11-20 10:00"
    Então o próximo passo de "Ana Ribeiro" é "Ligar para confirmar a visita" para "2026-11-20 10:00"
    E o histórico de "Ana Ribeiro" tem "next_step" feito por "Marina"

  Cenário: Próximo passo vazio limpa
    Dado "Marina" definiu o próximo passo de "Ana Ribeiro" como "Ligar" para "2026-11-20 10:00"
    Quando "Marina" limpa o próximo passo de "Ana Ribeiro"
    Então "Ana Ribeiro" fica sem próximo passo

  Cenário: Marcar a data da visita leva o lead para "Visita agendada"
    Quando "Marina" marca a visita de "Ana Ribeiro" para "2026-11-22 15:00"
    Então a visita de "Ana Ribeiro" fica para "2026-11-22 15:00"
    E "Ana Ribeiro" fica no estágio "visit_scheduled"
    E o histórico de "Ana Ribeiro" tem "visit_scheduled_at" feito por "Marina"

  Cenário: Outro corretor não mexe na ficha
    Quando "Rafael" tenta registrar a 1ª resposta, o próximo passo e a visita de "Ana Ribeiro"
    Então o banco recusa as três

  Cenário: Gestora também pode
    Quando "Paula" define o próximo passo de "Ana Ribeiro" como "Enviar proposta" para "2026-11-21 09:00"
    Então o próximo passo de "Ana Ribeiro" é "Enviar proposta" para "2026-11-21 09:00"
