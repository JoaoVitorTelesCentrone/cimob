# language: pt
@seguranca
Funcionalidade: Conversas e mensagens do WhatsApp no banco
  O bot grava conversas e mensagens como sistema. No CRM, cada um lê só o que já
  poderia ver do lead; ninguém grava mensagem pelo app.

  Contexto:
    Dado as imobiliárias "Horizonte" e "Alfa"
    E a "Horizonte" com a gestora "Paula" e os corretores "Marina" e "Rafael"
    E a "Alfa" com o gestor "Otávio"
    E o lead "Ana" de "Marina" na "Horizonte" com a conversa "Olá! Código: AUR-502"

  Cenário: Gestora lê as conversas e mensagens da própria imobiliária
    Quando "Paula" lista as conversas e as mensagens
    Então aparece a mensagem "Olá! Código: AUR-502"

  Cenário: Corretora dona do lead lê a conversa
    Quando "Marina" lista as conversas e as mensagens
    Então aparece a mensagem "Olá! Código: AUR-502"

  Cenário: Outro corretor não lê a conversa
    Quando "Rafael" lista as conversas e as mensagens
    Então nenhuma conversa nem mensagem aparece

  Cenário: Conversa ainda sem lead não aparece para o corretor
    Dado uma conversa sem lead na "Horizonte" com a mensagem "Oi"
    Quando "Rafael" lista as conversas e as mensagens
    Então nenhuma conversa nem mensagem aparece

  Cenário: Conversa ainda sem lead aparece para o gestor
    Dado uma conversa sem lead na "Horizonte" com a mensagem "Oi"
    Quando "Paula" lista as conversas e as mensagens
    Então aparece a mensagem "Oi"

  Cenário: Gestor de outra imobiliária não lê nada
    Quando "Otávio" lista as conversas e as mensagens
    Então nenhuma conversa nem mensagem aparece

  Cenário: Visitante anônimo não acessa dados do bot
    Quando um visitante anônimo consulta conversas, mensagens, consentimentos e números
    Então o acesso é negado em todas

  Cenário: Ninguém grava mensagem pelo app
    Quando "Paula" tenta gravar uma mensagem na conversa de "Ana"
    Então o banco recusa

  Cenário: Corretor não vê o número de WhatsApp da imobiliária
    Dado a "Horizonte" com o número do WhatsApp "PHONE_HZ"
    Quando "Marina" lista os números de WhatsApp
    Então nenhum número aparece

  Cenário: Gestora vê o número de WhatsApp da imobiliária
    Dado a "Horizonte" com o número do WhatsApp "PHONE_HZ"
    Quando "Paula" lista os números de WhatsApp
    Então aparece o número "PHONE_HZ"

  Cenário: O mesmo número não pode estar em duas imobiliárias
    Dado a "Horizonte" com o número do WhatsApp "PHONE_HZ"
    Quando o sistema cadastra o número "PHONE_HZ" na "Alfa"
    Então o banco recusa

  Cenário: A mesma mensagem do WhatsApp não é gravada duas vezes
    Quando o sistema grava de novo a mensagem da conversa de "Ana" com o mesmo id do WhatsApp
    Então o banco recusa

  Cenário: Conversa não pode apontar para lead de outra imobiliária
    Dado o lead "Bia" na "Alfa"
    Quando o sistema liga a conversa de "Ana" ao lead "Bia"
    Então o banco recusa

  Cenário: Consentimento não aparece para quem não vê o lead
    Dado "Ana" aceitou o aviso de privacidade "Usamos seus dados só para este atendimento."
    Quando "Rafael" lista os consentimentos
    Então nenhum consentimento aparece

  Cenário: Consentimento aparece para a corretora dona do lead
    Dado "Ana" aceitou o aviso de privacidade "Usamos seus dados só para este atendimento."
    Quando "Marina" lista os consentimentos
    Então aparece o consentimento "Usamos seus dados só para este atendimento."
