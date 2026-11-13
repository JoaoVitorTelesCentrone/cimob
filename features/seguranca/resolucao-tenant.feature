# language: pt
@seguranca
Funcionalidade: Resolução pública da imobiliária
  O site precisa descobrir a imobiliária de um visitante anônimo, sem abrir o resto dos dados.

  Contexto:
    Dado a organização "Horizonte" com o domínio próprio "www.horizonteimoveis.com.br"

  Cenário: Anônimo resolve pelo subdomínio
    Quando um visitante anônimo resolve o subdomínio "horizonte"
    Então recebe a organização "Horizonte"

  Cenário: Anônimo resolve pelo domínio próprio
    Quando um visitante anônimo resolve o domínio "www.horizonteimoveis.com.br"
    Então recebe a organização "Horizonte"

  Cenário: Imobiliária inexistente não devolve nada
    Quando um visitante anônimo resolve o subdomínio "fantasma"
    Então não recebe nenhuma organização

  Cenário: A resposta expõe só dados públicos
    Quando um visitante anônimo resolve o subdomínio "horizonte"
    Então a resposta tem apenas "id", "slug", "name" e "brand"

  Cenário: Consultar sem informar nada não devolve nada
    Quando um visitante anônimo resolve sem informar subdomínio nem domínio
    Então não recebe nenhuma organização
