# language: pt
@crm
Funcionalidade: Entrada de imobiliária e da equipe
  A Center One (admin da plataforma) cria a imobiliária e convida o primeiro gestor. O gestor
  convida e desativa os corretores, cuida da marca e do critério de qualificação. Número do
  WhatsApp do bot, conta de anúncios e tokens da Meta ficam com a Center One; o token vai para
  o cofre e ninguém lê de volta pelo app. Convite vira acesso quando a pessoa entra pela 1ª vez
  com o e-mail convidado.

  Contexto:
    Dado o admin da plataforma "Carlos"
    E a imobiliária "Horizonte" com a gestora "Paula" e a corretora "Marina"
    E a imobiliária "Alfa" com o gestor "Otávio"

  Cenário: Admin da plataforma cria a imobiliária e convida o gestor
    Quando "Carlos" cria a imobiliária "Lumen Imóveis" no endereço "lumen" com o gestor "Lia" de e-mail "lia@lumen.com.br"
    Então a imobiliária "Lumen Imóveis" existe no endereço "lumen"
    E "Carlos" acessa a "Lumen Imóveis" como agência
    E há um convite pendente para "lia@lumen.com.br" como gestor "Lia" na "Lumen Imóveis"

  Esquema do Cenário: Endereço inválido, reservado ou repetido é recusado
    Quando "Carlos" cria a imobiliária "Nova" no endereço "<endereço>" com o gestor "Lia" de e-mail "lia@nova.com.br"
    Então o banco recusa

    Exemplos:
      | endereço    |
      | app         |
      | www         |
      | horizonte   |
      | Com Espaço  |
      | -lumen      |

  Cenário: Gestor de imobiliária não cria imobiliária
    Quando "Paula" cria a imobiliária "Nova" no endereço "nova" com o gestor "Lia" de e-mail "lia@nova.com.br"
    Então o banco recusa

  Cenário: Gestora convida um corretor e ele entra pela 1ª vez
    Quando "Paula" convida "Rafael" de e-mail "Rafael@Exemplo.com" e WhatsApp "5511977770001" como corretor
    E a pessoa de e-mail "rafael@exemplo.com" entra pela 1ª vez
    Então "Rafael" é corretor ativo da "Horizonte" com o WhatsApp "5511977770001"
    E o convite de "rafael@exemplo.com" fica aceito

  Cenário: Convite só vale para o e-mail convidado
    Dado "Paula" convidou "Rafael" de e-mail "rafael@exemplo.com" como corretor
    Quando a pessoa de e-mail "intruso@exemplo.com" entra pela 1ª vez
    Então a pessoa de e-mail "intruso@exemplo.com" não é membro de nenhuma imobiliária

  Cenário: Corretora não convida
    Quando "Marina" convida "Rafael" de e-mail "rafael@exemplo.com" e WhatsApp "5511977770001" como corretor
    Então o banco recusa

  Cenário: Gestor de outra imobiliária não convida na Horizonte
    Quando "Otávio" convida para a "Horizonte" "Rafael" de e-mail "rafael@exemplo.com" como corretor
    Então o banco recusa

  Cenário: Gestora desativa a corretora, que perde o acesso e sai do rodízio
    Dado "Marina" está no rodízio
    Quando "Paula" desativa "Marina"
    Então "Marina" não lê mais os leads da "Horizonte"
    E "Marina" não está no rodízio

  Cenário: Gestora não desativa a si mesma
    Quando "Paula" desativa "Paula"
    Então o banco recusa

  Cenário: Gestora muda a marca e o critério de qualificação
    Quando "Paula" muda a marca para a cor "#1D4ED8", o CRECI "CRECI 12345-J" e o WhatsApp "5511900001111"
    E "Paula" muda o critério para prazo de até 3 meses e faixa cobrindo 100% do preço
    Então a marca da "Horizonte" tem a cor "#1D4ED8", o CRECI "CRECI 12345-J" e o WhatsApp "5511900001111"
    E o critério da "Horizonte" é prazo de até 3 meses e 100% do preço

  Cenário: Gestora não muda endereço, domínio nem plano
    Quando "Paula" tenta mudar o endereço, o domínio e o plano da "Horizonte"
    Então o banco recusa nas três

  Cenário: Corretora não muda a marca
    Quando "Marina" muda a marca para a cor "#000000", o CRECI "X" e o WhatsApp "5511900001111"
    Então a marca da "Horizonte" não mudou

  Cenário: Gestora define o horário de atendimento
    Quando "Paula" define o horário de atendimento de segunda a sexta, das 09:00 às 18:00
    Então o horário de atendimento da "Horizonte" é de segunda a sexta, das 09:00 às 18:00

  Cenário: Corretora não muda o horário de atendimento
    Quando "Marina" define o horário de atendimento de segunda a sexta, das 09:00 às 18:00
    Então a "Horizonte" continua sem horário de atendimento

  Cenário: Admin da plataforma configura o WhatsApp do bot e a conta de anúncios, com token no cofre
    Quando "Carlos" configura na "Horizonte" o número "PHONE_H" com o token "EAAG-wa-segredo-123"
    E "Carlos" configura na "Horizonte" a conta de anúncios "act_777" com o token "EAAG-ads-segredo-456"
    Então o token do número "PHONE_H" no cofre é "EAAG-wa-segredo-123"
    E o token da conta "act_777" no cofre é "EAAG-ads-segredo-456"
    E "Paula" vê o número "PHONE_H" e a conta "act_777" com token guardado, sem ver os tokens

  Cenário: Gestora não configura o número do bot
    Quando "Paula" configura na "Horizonte" o número "PHONE_X" com o token "EAAG-qualquer"
    Então o banco recusa

  Cenário: Gestora cancela um convite pendente
    Dado "Paula" convidou "Rafael" de e-mail "rafael@exemplo.com" como corretor
    Quando "Paula" cancela o convite de "rafael@exemplo.com"
    E a pessoa de e-mail "rafael@exemplo.com" entra pela 1ª vez
    Então a pessoa de e-mail "rafael@exemplo.com" não é membro de nenhuma imobiliária

  Cenário: Convite aceito não se cancela e corretora não cancela
    Dado "Paula" convidou "Rafael" de e-mail "rafael@exemplo.com" como corretor
    Quando "Marina" tenta cancelar o convite de "rafael@exemplo.com"
    Então o banco recusa
    E o convite de "rafael@exemplo.com" continua pendente
