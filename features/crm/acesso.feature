# language: pt
@crm
Funcionalidade: Acesso ao CRM por link mágico
  O corretor ou gestor entra pelo e-mail, sem senha, e trabalha dentro de uma imobiliária.

  Cenário: Visitante sem sessão é levado ao login
    Quando alguém sem sessão abre "/app/leads"
    Então é redirecionado para "/login"

  Cenário: Quem já está logado não vê a tela de login
    Quando alguém com sessão abre "/login"
    Então é redirecionado para "/app"

  Cenário: Páginas públicas não exigem login
    Quando alguém sem sessão abre "/"
    Então não há redirecionamento

  Esquema do Cenário: E-mail inválido é recusado
    Quando a pessoa pede o link com o e-mail "<email>"
    Então vê a mensagem "Informe um e-mail válido"

    Exemplos:
      | email   |
      |         |
      | ana     |
      | ana@    |
      | @x.com  |

  Cenário: E-mail válido é aceito e normalizado
    Quando a pessoa pede o link com o e-mail "  Ana@Horizonte.com.br "
    Então o link é enviado para "ana@horizonte.com.br"

  Cenário: Quem tem uma só imobiliária entra direto nela
    Dado o usuário pertence a "Horizonte"
    Quando termina o login
    Então entra na "Horizonte"

  Cenário: Quem tem várias imobiliárias escolhe uma
    Dado o usuário pertence a "Horizonte" e "Alfa"
    Quando termina o login
    Então escolhe entre "Horizonte" e "Alfa"

  Cenário: A última imobiliária usada é lembrada
    Dado o usuário pertence a "Horizonte" e "Alfa"
    E a última imobiliária usada foi "Alfa"
    Quando termina o login
    Então entra na "Alfa"

  Cenário: Imobiliária lembrada que o usuário perdeu é ignorada
    Dado o usuário pertence a "Horizonte" e "Alfa"
    E a última imobiliária usada foi "Beta"
    Quando termina o login
    Então escolhe entre "Horizonte" e "Alfa"

  Cenário: Usuário sem imobiliária não entra no CRM
    Dado o usuário não pertence a nenhuma imobiliária
    Quando termina o login
    Então vê a mensagem "Você ainda não tem acesso a nenhuma imobiliária"
