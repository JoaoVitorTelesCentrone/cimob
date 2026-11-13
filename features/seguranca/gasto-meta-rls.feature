# language: pt
@seguranca
Funcionalidade: Gasto de anúncios e contas da Meta no banco
  Investimento é dado sensível da imobiliária: só o gestor lê o gasto diário e a conta de
  anúncios da própria imobiliária. Corretor, outra imobiliária e visitante não veem nada,
  e ninguém grava gasto pelo app: quem grava é o apps/bot.

  Contexto:
    Dado as imobiliárias "Horizonte" e "Alfa"
    E a "Horizonte" com a gestora "Paula" e a corretora "Marina"
    E a "Alfa" com o gestor "Otávio"
    E a "Horizonte" com a conta de anúncios "act_111"
    E a "Horizonte" com gasto de "120,50" em "2026-11-12" no anúncio "ad_1"

  Cenário: Gestora lê o gasto da própria imobiliária
    Quando "Paula" lista o gasto diário
    Então aparece o gasto de "120,50" do anúncio "ad_1"

  Cenário: Corretora não lê o gasto
    Quando "Marina" lista o gasto diário
    Então nenhum gasto aparece

  Cenário: Gestor de outra imobiliária não lê o gasto
    Quando "Otávio" lista o gasto diário
    Então nenhum gasto aparece

  Cenário: Gestora vê a conta de anúncios da própria imobiliária
    Quando "Paula" lista as contas de anúncios
    Então aparece a conta "act_111"

  Cenário: Corretora não vê a conta de anúncios
    Quando "Marina" lista as contas de anúncios
    Então nenhuma conta aparece

  Cenário: Visitante anônimo não acessa gasto nem contas de anúncios
    Quando um visitante anônimo consulta gasto diário e contas de anúncios
    Então o acesso é negado nas duas

  Cenário: Ninguém grava gasto pelo app
    Quando "Paula" tenta gravar um gasto na "Horizonte"
    Então o banco recusa

  Cenário: A mesma conta de anúncios não pode estar em duas imobiliárias
    Quando o sistema cadastra a conta "act_111" na "Alfa"
    Então o banco recusa
