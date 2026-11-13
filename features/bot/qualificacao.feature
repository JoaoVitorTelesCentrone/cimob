# language: pt
@bot
Funcionalidade: Qualificação do lead pelo bot
  Para que o corretor receba só oportunidades com contexto
  Como imobiliária
  Quero que o bot faça as perguntas básicas e passe o lead qualificado ao corretor

  Contexto:
    Dado a imobiliária "Horizonte Imóveis" com os corretores no rodízio:
      | nome          |
      | Marina Alves  |
      | Rafael Souza  |
    E a unidade "AUR-502" com preço de R$ 765.000 e status "disponível"

  Cenário: Lead vindo do anúncio completa o fluxo e é qualificado
    Quando o contato "5511987654321" envia "Olá! Quero saber da unidade 502. Código: AUR-502"
    Então o bot se apresenta como assistente virtual e oferece "Atendente"
    E o bot pergunta se é para morar ou investir
    Quando o contato responde, em sequência:
      | resposta       |
      | Morar          |
      | R$ 600–800 mil |
      | Até 3 meses    |
      | Sim            |
      | ana souza      |
    Então um lead "Ana Souza" é criado no estágio "qualificado"
    E o lead é atribuído a "Marina Alves"
    E o bot pausa a conversa

  Cenário: O lead aparece no CRM desde a primeira mensagem
    Quando o contato "5511987654321" envia "Olá! Código: AUR-502"
    Então existe um lead do telefone "5511987654321" no estágio "novo" ligado à unidade "AUR-502"
    E o lead tem a origem "whatsapp"

  Cenário: Quem continua a conversa depois do aviso de privacidade tem o consentimento registrado
    Quando o contato "5511987654321" envia "Olá! Código: AUR-502"
    Então a saudação traz o aviso de privacidade
    E nenhum consentimento é registrado ainda
    Quando o contato responde "Morar"
    Então o consentimento com o texto do aviso fica registrado

  Esquema do Cenário: Critério de qualificação
    Dado um lead interessado na unidade "AUR-502"
    Quando ele informa a faixa "<faixa>" e o prazo "<prazo>"
    Então o lead fica "<resultado>"

    Exemplos:
      | faixa              | prazo           | resultado      |
      | R$ 600–800 mil     | Até 3 meses     | qualificado    |
      | Até R$ 600 mil     | Até 3 meses     | em nutrição    |
      | R$ 800 mil–1,2 mi  | Mais de 6 meses | em nutrição    |
      | Acima de R$ 1,2 mi | Imediato        | qualificado    |

  Esquema do Cenário: Lead sem unidade é qualificado só pelo prazo
    Dado um lead sem unidade de interesse
    Quando ele informa a faixa "<faixa>" e o prazo "<prazo>"
    Então o lead fica "<resultado>"

    Exemplos:
      | faixa          | prazo           | resultado   |
      | Até R$ 600 mil | 3 a 6 meses     | qualificado |
      | Até R$ 600 mil | Mais de 6 meses | em nutrição |

  Cenário: Lead em nutrição não é passado a um corretor
    Quando o contato "5511900002222" envia "Oi! Código: AUR-502"
    E o contato responde, em sequência:
      | resposta        |
      | Investir        |
      | Até R$ 600 mil  |
      | Mais de 6 meses |
      | Ainda não       |
      | Carla           |
    Então o lead "Carla" fica em nutrição sem corretor

  Cenário: Resposta digitada que corresponde a uma opção é aceita
    Quando o contato "5511987654321" envia "Oi! Código: AUR-502"
    E o contato digita "quero morar"
    Então o bot pergunta a faixa de investimento

  Cenário: Duas respostas não entendidas passam o lead ao corretor
    Quando o contato "5511987654321" envia "Oi! Código: AUR-502"
    E o contato digita "banana"
    Então o bot repete a pergunta de morar ou investir
    Quando o contato digita "laranja"
    Então o lead é atribuído a um corretor com a marcação "não entendido"

  Cenário: Pedido de atendente interrompe o fluxo
    Quando o contato "5511900001111" envia "atendente"
    Então o bot pergunta apenas o nome
    Quando o contato responde "Bruno"
    Então o lead "Bruno" é atribuído a um corretor com a marcação "pediu atendente"

  Cenário: Conversa com o corretor não recebe resposta do bot
    Dado uma conversa já passada ao corretor
    Quando o contato digita "oi, ainda está aí?"
    Então o bot não responde
