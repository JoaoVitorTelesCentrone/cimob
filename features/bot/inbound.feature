# language: pt
@bot
Funcionalidade: Mensagens recebidas pelo worker
  O worker tira o payload da fila, descobre a imobiliária pelo número que recebeu a mensagem,
  grava cada mensagem uma vez só e aciona o bot para as novas.

  Contexto:
    Dado a imobiliária "Horizonte" com o número do WhatsApp "PHONE_HZ"

  Cenário: Mensagem nova é gravada na conversa do contato e aciona o bot
    Quando chega a mensagem "wamid.1" de "5511987654321" para "PHONE_HZ" com o texto "Olá! Código: AUR-502"
    Então a conversa de "5511987654321" na "Horizonte" tem a mensagem recebida "Olá! Código: AUR-502"
    E o bot é acionado 1 vez

  Cenário: A mesma mensagem processada duas vezes ao mesmo tempo é gravada e tratada uma vez
    Quando a mensagem "wamid.1" de "5511987654321" para "PHONE_HZ" é processada 2 vezes ao mesmo tempo
    Então a conversa de "5511987654321" na "Horizonte" tem 1 mensagem
    E o bot é acionado 1 vez

  Cenário: Número que não é de nenhuma imobiliária é descartado sem nova tentativa
    Quando chega a mensagem "wamid.2" de "5511987654321" para "PHONE_DESCONHECIDO" com o texto "Oi"
    Então nenhuma mensagem é gravada
    E o processamento termina sem erro

  Cenário: O mesmo contato em duas imobiliárias tem conversas separadas
    Dado a imobiliária "Alfa" com o número do WhatsApp "PHONE_ALFA"
    Quando chega a mensagem "wamid.3" de "5511987654321" para "PHONE_HZ" com o texto "Oi Horizonte"
    E chega a mensagem "wamid.4" de "5511987654321" para "PHONE_ALFA" com o texto "Oi Alfa"
    Então a conversa de "5511987654321" na "Horizonte" tem a mensagem recebida "Oi Horizonte"
    E a conversa de "5511987654321" na "Alfa" tem a mensagem recebida "Oi Alfa"

  Cenário: Resposta de botão é gravada com o título que o contato viu
    Quando chega a resposta de botão "wamid.5" de "5511987654321" para "PHONE_HZ" com o título "Morar" e o id "goal_live"
    Então a conversa de "5511987654321" na "Horizonte" tem a mensagem recebida "Morar" do tipo "interactive"

  Cenário: Áudio é gravado sem texto (a transcrição vem depois)
    Quando chega um áudio "wamid.6" de "5511987654321" para "PHONE_HZ"
    Então a conversa de "5511987654321" na "Horizonte" tem 1 mensagem do tipo "audio" sem texto

  Cenário: Contato que já é lead fica ligado à conversa
    Dado o lead "Ana Souza" com o telefone "5511987654321" na "Horizonte"
    Quando chega a mensagem "wamid.7" de "5511987654321" para "PHONE_HZ" com o texto "Voltei"
    Então a conversa de "5511987654321" na "Horizonte" fica ligada ao lead "Ana Souza"

  Cenário: Aviso de entrega e leitura não vira mensagem
    Quando chega um aviso de leitura para "PHONE_HZ"
    Então nenhuma mensagem é gravada
    E o bot não é acionado

  Cenário: Erro no bot desfaz a gravação e a nova tentativa trata a mensagem
    Dado o bot falha na primeira tentativa
    Quando chega a mensagem "wamid.8" de "5511987654321" para "PHONE_HZ" com o texto "Oi"
    E a fila tenta de novo a mesma mensagem
    Então a conversa de "5511987654321" na "Horizonte" tem 1 mensagem
    E o bot trata a mensagem com sucesso 1 vez
