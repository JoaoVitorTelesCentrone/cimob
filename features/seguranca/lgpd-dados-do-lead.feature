# language: pt
@seguranca
Funcionalidade: Exportar e excluir os dados de um lead (LGPD)
  O titular pode pedir uma cópia dos seus dados ou a exclusão deles. Só o gestor da
  imobiliária atende: exporta tudo o que guardamos do lead (ficha, conversa, histórico e
  consentimento) ou apaga tudo, inclusive o resumo enviado ao WhatsApp do corretor. Da
  exclusão fica só um registro anônimo (quando e quem fez), sem nome nem telefone.

  Contexto:
    Dado a imobiliária "Horizonte" com a gestora "Paula" e a corretora "Marina"
    E a imobiliária "Alfa" com o gestor "Otávio"
    E o lead "Ana Ribeiro" da "Horizonte", telefone "5511987654321", com a corretora "Marina"
    E a conversa de "Ana Ribeiro" com as mensagens:
      | direção | texto                                |
      | entrada | Olá! Código: AUR-502                 |
      | saída   | Oi! Antes de seguir, veja o aviso... |
    E "Ana Ribeiro" aceitou o aviso de privacidade
    E o resumo de "Ana Ribeiro" foi enviado ao WhatsApp de "Marina"
    E o lead "Bruno Lima" da "Horizonte" com uma conversa

  Cenário: Gestora exporta os dados do lead
    Quando "Paula" exporta os dados de "Ana Ribeiro"
    Então a exportação traz o nome "Ana Ribeiro" e o telefone "5511987654321"
    E a exportação traz as 2 mensagens da conversa, na ordem
    E a exportação traz o consentimento com o texto mostrado
    E o histórico de "Ana Ribeiro" registra a exportação feita por "Paula"

  Cenário: Corretora dona do lead não exporta
    Quando "Marina" exporta os dados de "Ana Ribeiro"
    Então o banco recusa

  Cenário: Gestor de outra imobiliária não exporta
    Quando "Otávio" exporta os dados de "Ana Ribeiro"
    Então o banco recusa

  Cenário: Gestora exclui os dados do lead
    Quando "Paula" exclui os dados de "Ana Ribeiro"
    Então não sobra nada de "Ana Ribeiro": lead, conversa, mensagens, histórico e consentimento
    E o resumo enviado a "Marina" também foi apagado
    E fica um registro de exclusão da "Horizonte" feito por "Paula", sem nome nem telefone
    E o lead "Bruno Lima" e a conversa dele continuam

  Cenário: Corretora dona do lead não exclui
    Quando "Marina" exclui os dados de "Ana Ribeiro"
    Então o banco recusa
    E o lead "Ana Ribeiro" continua

  Cenário: Gestor de outra imobiliária não exclui
    Quando "Otávio" exclui os dados de "Ana Ribeiro"
    Então o banco recusa
    E o lead "Ana Ribeiro" continua

  Cenário: Visitante anônimo não exporta nem exclui
    Quando um visitante anônimo tenta exportar e excluir os dados de "Ana Ribeiro"
    Então o acesso é negado nas duas

  Cenário: Registro de exclusão só para o gestor da própria imobiliária
    Dado "Paula" excluiu os dados de "Ana Ribeiro"
    Então os registros de exclusão que cada um vê são:
      | pessoa | registros |
      | Paula  | 1         |
      | Marina | 0         |
      | Otávio | 0         |
    E ninguém grava nem apaga registro de exclusão pelo app
