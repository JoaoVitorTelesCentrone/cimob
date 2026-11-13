# language: pt
@site
Funcionalidade: Resolução da imobiliária pelo endereço
  O site público de cada imobiliária responde pelo subdomínio ou pelo domínio próprio.
  O CRM e o login ignoram o endereço: o tenant vem da sessão.

  Esquema do Cenário: Subdomínio identifica a imobiliária
    Quando chega uma requisição para "<host>" em "/"
    Então a imobiliária consultada é "horizonte"
    E a página é servida de "/horizonte"

    Exemplos:
      | host                      |
      | horizonte.c1imob.com.br   |
      | horizonte.localhost:3000  |
      | HORIZONTE.C1IMOB.COM.BR   |

  Cenário: Domínio próprio identifica a imobiliária
    Dado o domínio "www.horizonteimoveis.com.br" pertence à "horizonte"
    Quando chega uma requisição para "www.horizonteimoveis.com.br" em "/empreendimento"
    Então a página é servida de "/horizonte/empreendimento"

  Esquema do Cenário: Endereço da plataforma não tem imobiliária
    Quando chega uma requisição para "<host>" em "/login"
    Então nenhuma imobiliária é consultada
    E a requisição segue sem reescrita

    Exemplos:
      | host              |
      | c1imob.com.br    |
      | www.c1imob.com.br |
      | localhost:3000    |

  Cenário: Imobiliária inexistente dá 404
    Quando chega uma requisição para "fantasma.c1imob.com.br" em "/"
    Então a resposta é 404

  Esquema do Cenário: CRM e login ignoram o endereço
    Quando chega uma requisição para "horizonte.c1imob.com.br" em "<caminho>"
    Então nenhuma imobiliária é consultada
    E a requisição segue sem reescrita

    Exemplos:
      | caminho         |
      | /app            |
      | /app/leads      |
      | /login          |
      | /auth/callback  |

  Cenário: A imobiliária resolvida vai num cabeçalho interno
    Quando chega uma requisição para "horizonte.c1imob.com.br" em "/"
    Então o cabeçalho interno "x-organization-id" é o da "horizonte"

  Cenário: Cabeçalho interno forjado pelo visitante é descartado
    Quando chega uma requisição para "c1imob.com.br" em "/login" com o cabeçalho "x-organization-id" igual a "forjado"
    Então o cabeçalho interno "x-organization-id" não existe

  Cenário: A consulta da imobiliária é guardada por um tempo
    Quando a mesma imobiliária é consultada duas vezes em 10 segundos
    Então o banco é consultado uma vez
    E depois de 2 minutos o banco é consultado de novo
