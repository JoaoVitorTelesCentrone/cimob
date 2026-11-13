# language: pt
@seguranca
Funcionalidade: Isolamento entre imobiliárias

  Contexto:
    Dado as imobiliárias "Horizonte" e "Alfa"
    E o lead "Ana" pertence a "Horizonte"

  Cenário: Usuário de outra imobiliária não vê o lead
    Quando o gestor da "Alfa" lista os leads
    Então "Ana" não aparece

  Cenário: Corretor vê só os próprios leads
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    Quando o corretor "Rafael" da "Horizonte" lista os leads
    Então "Ana" não aparece

  Cenário: Corretor vê o lead atribuído a ele
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    Quando o corretor "Marina" da "Horizonte" lista os leads
    Então "Ana" aparece

  Cenário: Lead ainda sem corretor só aparece para o gestor
    Quando o corretor "Rafael" da "Horizonte" lista os leads
    Então "Ana" não aparece

  Cenário: Gestor vê todos os leads da própria imobiliária
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    Quando o gestor da "Horizonte" lista os leads
    Então "Ana" aparece

  Cenário: Visitante anônimo do site não acessa leads
    Quando um visitante anônimo consulta os leads de "Horizonte"
    Então o acesso é negado

  Cenário: Corretor não altera lead de outro corretor
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    Quando o corretor "Rafael" da "Horizonte" tenta mover "Ana" para "contacted"
    Então a alteração é negada

  Cenário: Corretor altera o próprio lead
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    Quando o corretor "Marina" da "Horizonte" tenta mover "Ana" para "contacted"
    Então "Ana" está no estágio "contacted"

  Cenário: Histórico do lead fica oculto para quem não vê o lead
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    E "Ana" tem o evento "message_received"
    Quando o corretor "Rafael" da "Horizonte" lista os eventos
    Então nenhum evento aparece

  Cenário: Histórico do lead aparece para o corretor dono do lead
    Dado "Ana" atribuída a "Marina" da "Horizonte"
    E "Ana" tem o evento "message_received"
    Quando o corretor "Marina" da "Horizonte" lista os eventos
    Então aparece o evento "message_received"

  Cenário: Lead não pode apontar para unidade de outra imobiliária
    Dado a unidade "AUR-502" pertence a "Alfa"
    Quando o sistema vincula "Ana" à unidade "AUR-502"
    Então o banco recusa o vínculo

  Cenário: Mesmo telefone na mesma imobiliária é recusado
    Quando o sistema cria outro lead com o telefone de "Ana" em "Horizonte"
    Então o banco recusa o lead

  Cenário: Mesmo telefone em outra imobiliária é aceito
    Quando o sistema cria outro lead com o telefone de "Ana" em "Alfa"
    Então o lead é criado

  Cenário: Corretor não cria lead em outra imobiliária
    Quando o corretor "Rafael" da "Horizonte" tenta criar um lead na "Alfa"
    Então o banco recusa o lead
