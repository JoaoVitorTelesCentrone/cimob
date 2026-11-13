# language: pt
@bot
Funcionalidade: Envio das respostas do bot pelo WhatsApp
  O bot escreve as respostas no banco; o worker de envio manda pela Cloud API da Meta,
  na ordem certa, tentando de novo quando a Meta pede e avisando a operação quando não dá.

  Contexto:
    Dado a imobiliária "Horizonte" com o número do WhatsApp "PHONE_ENVIO" e o token guardado no cofre
    E o contato "5511987654321" mandou "Olá! Código: AUR-502" e o bot deixou as respostas para enviar

  Cenário: As respostas saem na ordem em que o bot escreveu
    Dado o contato perguntou "qual o valor?"
    Quando o worker de envio roda para a conversa
    Então a Meta recebe 3 mensagens para "5511987654321", na ordem em que o bot escreveu
    E todas ficam marcadas como enviadas, com o id que a Meta devolveu

  Cenário: O envio usa o token da imobiliária, e o token não aparece em logs nem alertas
    Quando o worker de envio roda para a conversa
    Então a Meta recebe as mensagens com o token da "Horizonte"
    E o token não aparece em nenhum log nem alerta

  Cenário: Meta pede para esperar (limite de envio) e o envio é tentado de novo
    Dado a Meta responde "limite de envio" na primeira tentativa
    Quando o worker de envio roda para a conversa
    Então o envio é adiado para tentar de novo
    E a resposta continua pendente
    Quando o worker de envio roda de novo para a conversa
    Então todas ficam marcadas como enviadas, com o id que a Meta devolveu

  Cenário: Meta fora do ar é tentada de novo sem marcar falha
    Dado a Meta responde "erro interno" na primeira tentativa
    Quando o worker de envio roda para a conversa
    Então o envio é adiado para tentar de novo
    E a resposta continua pendente

  Cenário: Erro definitivo da Meta marca a falha e avisa a operação
    Dado a Meta responde "fora da janela de 24 horas" para a primeira mensagem
    Quando o worker de envio roda para a conversa
    Então a primeira resposta fica marcada como falha com o código da Meta
    E a operação recebe um alerta de falha de envio
    E não há nova tentativa

  Cenário: Mensagem já enviada não é enviada de novo
    Dado o worker de envio já rodou para a conversa
    Quando o worker de envio roda de novo para a conversa
    Então a Meta não recebe nenhuma mensagem nova

  Cenário: Envio que esgotou as tentativas vai para a fila de mortos e avisa a operação
    Quando o envio da conversa esgota as tentativas
    Então o job vai para a fila de mortos
    E a operação recebe um alerta de falha de envio

  Cenário: Número sem token configurado não envia e avisa a operação
    Dado o número da "Horizonte" está sem token
    Quando o worker de envio roda para a conversa
    Então a Meta não recebe nenhuma mensagem nova
    E a operação recebe um alerta de falha de envio
    E a resposta continua pendente
