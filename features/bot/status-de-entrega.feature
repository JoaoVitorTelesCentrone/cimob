# language: pt
@bot
Funcionalidade: Status de entrega das mensagens enviadas
  A Meta avisa pelo webhook quando a mensagem que o bot mandou foi entregue, lida ou recusada
  depois de aceita. O bot grava isso na própria mensagem; a recusa vira falha e alerta para a
  operação. Aviso de um número só mexe em mensagens da imobiliária dona desse número.

  Contexto:
    Dado a imobiliária "Horizonte" com o número do WhatsApp "PHONE_HZ"
    E a mensagem "wamid.out1" enviada pelo bot para "5511987654321" na "Horizonte"

  Cenário: Entregue e lida ficam registradas na mensagem
    Quando a Meta avisa pelo "PHONE_HZ" que "wamid.out1" foi entregue
    E a Meta avisa pelo "PHONE_HZ" que "wamid.out1" foi lida
    Então a mensagem "wamid.out1" está marcada como entregue e lida

  Cenário: Leitura que chega antes da entrega também marca a entrega
    Quando a Meta avisa pelo "PHONE_HZ" que "wamid.out1" foi lida
    Então a mensagem "wamid.out1" está marcada como entregue e lida

  Cenário: Recusa depois de aceita marca a falha e alerta a operação
    Quando a Meta avisa pelo "PHONE_HZ" que "wamid.out1" falhou com o erro 131026 "Message undeliverable"
    Então a mensagem "wamid.out1" fica com a falha "131026 Message undeliverable"
    E a operação recebe um alerta de falha de entrega na "Horizonte"

  Cenário: Aviso pelo número de outra imobiliária não mexe na mensagem
    Dado a imobiliária "Alfa" com o número do WhatsApp "PHONE_ALFA"
    Quando a Meta avisa pelo "PHONE_ALFA" que "wamid.out1" foi entregue
    Então a mensagem "wamid.out1" não está marcada como entregue
