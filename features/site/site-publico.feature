# language: pt
@site
Funcionalidade: Site público da imobiliária
  Cada imobiliária tem um site com o empreendimento publicado, o contato pelo WhatsApp e o CRECI.
  Tudo o que aparece vem da ficha: o site nunca inventa preço, área ou disponibilidade.

  Contexto:
    Dado a imobiliária "Horizonte Imóveis" com CRECI "CRECI 12345-J" e WhatsApp "5511900000000"
    E o empreendimento publicado "Residencial Aurora" em "Vila Mariana, São Paulo" com entrega em "2028-12-01"
    E as unidades:
      | código  | quartos | área   | preço     | status    |
      | AUR-101 | 2       | 58.00  | 520000.00 | available |
      | AUR-502 | 3       | 82.00  | 765000.00 | available |
      | AUR-503 | 3       | 82.00  | 760000.00 | reserved  |
      | AUR-703 | 3       | 120.00 | 990000.00 | sold      |

  Cenário: O destaque mostra o empreendimento com os números da ficha
    Quando o visitante abre o site
    Então o destaque é "Residencial Aurora"
    E o resumo é "Vila Mariana, São Paulo · Entrega dez/2028"
    E aparecem "2 unidades disponíveis" e "a partir de R$ 520.000"
    E as plantas são "2 e 3 dormitórios, de 58 a 120 m²"

  Cenário: Preço de unidade reservada ou vendida não entra no "a partir de"
    Dado as unidades disponíveis estão sem preço na ficha
    Quando o visitante abre o site
    Então não aparece "a partir de"

  Cenário: Sem unidade disponível, o site diz isso
    Dado todas as unidades estão vendidas
    Quando o visitante abre o site
    Então aparece "Nenhuma unidade disponível no momento"

  Cenário: O WhatsApp abre a conversa com a imobiliária já falando do empreendimento
    Quando o visitante abre o site
    Então o botão do WhatsApp aponta para "5511900000000" com o texto "Olá! Vi o site e quero saber mais sobre o Residencial Aurora."
    E o botão de visita aponta para "5511900000000" com o texto "Olá! Quero agendar uma visita ao Residencial Aurora."

  Cenário: Sem WhatsApp cadastrado, não há botão de WhatsApp
    Dado a imobiliária está sem WhatsApp cadastrado
    Quando o visitante abre o site
    Então não aparece botão de WhatsApp

  Cenário: O rodapé traz o CRECI e a assinatura da Center One
    Quando o visitante abre o site
    Então o rodapé mostra "Horizonte Imóveis · CRECI 12345-J"
    E o rodapé mostra "Site por Center One"

  Cenário: Dados de demonstração aparecem marcados
    Dado o empreendimento é de demonstração
    Quando o visitante abre o site
    Então aparece o aviso "Demonstração: imobiliária, empreendimento, preços e disponibilidade são fictícios."

  Cenário: Imobiliária sem empreendimento publicado
    Dado nenhum empreendimento está publicado
    Quando o visitante abre o site
    Então aparece "Em breve, novos lançamentos"
