# language: pt
@bot @seguranca
Funcionalidade: Webhook do WhatsApp confiável
  A Meta entrega as mensagens no webhook. Ele confere a assinatura, responde rápido
  e só enfileira; o processamento acontece depois, no worker.

  Contexto:
    Dado o webhook configurado com o token de verificação "tok-verifica" e o segredo do app "segredo-app"

  Cenário: A Meta verifica o webhook com o token certo
    Quando a Meta pede a verificação com o token "tok-verifica" e o desafio "1158201444"
    Então a resposta é 200 com o corpo "1158201444"

  Cenário: Verificação com token errado é recusada
    Quando a Meta pede a verificação com o token "outro" e o desafio "1158201444"
    Então a resposta é 403

  Cenário: Mensagem com assinatura válida é enfileirada
    Quando chega uma mensagem válida
    Então a resposta é 200
    E o payload bruto é enfileirado em "inbound" uma vez

  Cenário: Assinatura inválida é recusada
    Quando chega um POST no webhook com assinatura inválida
    Então a resposta é 401
    E nada é enfileirado

  Cenário: POST sem assinatura é recusado
    Quando chega um POST no webhook sem assinatura
    Então a resposta é 401
    E nada é enfileirado

  Cenário: Corpo que não é JSON é recusado mesmo assinado
    Quando chega um POST assinado com o corpo "isto não é json"
    Então a resposta é 400
    E nada é enfileirado

  Cenário: A mesma entrega repetida pela Meta é enfileirada uma vez só
    Quando a mesma mensagem válida chega 2 vezes
    Então o payload bruto é enfileirado em "inbound" uma vez

  Cenário: Webhook responde rápido mesmo com o LLM lento
    Dado o LLM leva 10 segundos para responder
    Quando chega uma mensagem válida
    Então o webhook responde 200 em menos de 1 segundo

  Cenário: Fila fora do ar faz a Meta tentar de novo
    Dado a fila está fora do ar
    Quando chega uma mensagem válida
    Então a resposta é 503

  Cenário: Mensagem duplicada gera uma resposta só
    Dado o webhook recebeu a mensagem "wamid.ABC123"
    Quando o webhook recebe de novo a mensagem "wamid.ABC123"
    Então apenas uma resposta é enviada ao contato
    E existe apenas uma mensagem "wamid.ABC123" gravada
