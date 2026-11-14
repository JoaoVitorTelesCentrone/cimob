# language: pt
@crm
Funcionalidade: Conversa do lead na ficha
  A ficha mostra a conversa do contato com o bot, em ordem, e se cada mensagem do bot foi
  enviada, entregue, lida ou recusada pela Meta. É só leitura: o corretor responde pelo WhatsApp.
  O corretor vê a conversa só dos próprios leads (o RLS de mensagens segue o do lead).

  Cenário: A ficha mostra a conversa em ordem com o status de entrega
    Dado a conversa de "Ana Ribeiro" com o bot:
      | de      | texto                    | status   |
      | contato | Olá! Código: AUR-502     |          |
      | bot     | Oi! Qual o seu objetivo? | lida     |
      | contato | Morar                    |          |
      | bot     | Qual a sua faixa?        | entregue |
      | bot     | Pode me dizer seu nome?  | enviada  |
      | bot     | Obrigado!                | falhou   |
      | bot     | Já te passo ao corretor  | na fila  |
    Quando abro a ficha de "Ana Ribeiro"
    Então a conversa mostra as 7 mensagens na ordem em que aconteceram
    E as mensagens do bot aparecem como "Lida", "Entregue", "Enviada", "Não entregue" e "Na fila"

  Cenário: Áudio sem transcrição aparece como áudio
    Dado a conversa de "Ana Ribeiro" com o bot:
      | de      | texto | status | tipo  |
      | contato |       |        | audio |
    Quando abro a ficha de "Ana Ribeiro"
    Então a conversa mostra "Áudio (sem transcrição)"

  Cenário: Lead sem conversa mostra um aviso
    Dado "Bruno Lima" sem conversa com o bot
    Quando abro a ficha de "Bruno Lima"
    Então a ficha diz "Sem conversa com o bot ainda."
