# language: pt
@crm
Funcionalidade: Importar tabela de preços em PDF da incorporadora
  O gestor envia o PDF da tabela de preços; o leitor (services/ingest) extrai as linhas e elas
  ficam num rascunho. Nada muda no site nem no bot até o gestor revisar e publicar. Publicar
  atualiza as unidades com o mesmo código e cria as novas; nunca apaga unidade que não está no
  PDF. O que o PDF não deixou ler fica em branco e marcado para revisão, sem sobrescrever o que
  já existia.

  Contexto:
    Dado a imobiliária "Horizonte" com a gestora "Paula" e a corretora "Marina"
    E o empreendimento publicado "Residencial Aurora" com as unidades:
      | código  | preço   | situação   |
      | AUR-501 | 700.000 | disponível |
      | AUR-502 | 765.000 | disponível |

  Cenário: PDF vira rascunho para revisão
    Quando "Paula" importa o PDF "tabela-aurora-nov.pdf" do "Residencial Aurora" com as linhas:
      | código  | área  | preço   | situação   | revisar |
      | AUR-502 | 68,50 | 780.000 | disponível | não     |
      | AUR-503 | 72,00 | 812.000 | disponível | não     |
    Então a importação fica em rascunho com 2 linhas
    E o site continua com "AUR-502" a "765.000" e sem "AUR-503"

  Cenário: Publicar atualiza e cria, sem apagar
    Dado um rascunho do "Residencial Aurora" com as linhas:
      | código  | área  | preço   | situação   | revisar |
      | AUR-502 | 68,50 | 780.000 | reservado  | não     |
      | AUR-503 | 72,00 | 812.000 | disponível | não     |
    Quando "Paula" publica a importação
    Então as unidades do "Residencial Aurora" ficam:
      | código  | preço   | situação   |
      | AUR-501 | 700.000 | disponível |
      | AUR-502 | 780.000 | reservado  |
      | AUR-503 | 812.000 | disponível |
    E a importação fica publicada
    E publicar de novo é recusado

  Cenário: Linha ilegível não é inventada
    Dado um rascunho do "Residencial Aurora" com as linhas:
      | código  | área  | preço | situação   | revisar |
      | AUR-502 | 68,50 |       | disponível | sim     |
      | AUR-704 | 68,50 |       | disponível | sim     |
    Quando "Paula" publica a importação
    Então "AUR-704" fica com o preço em branco
    E "AUR-502" continua com o preço "765.000"

  Cenário: Unidade nova com situação ilegível não entra como disponível
    Dado um rascunho do "Residencial Aurora" com as linhas:
      | código  | área  | preço   | situação | revisar |
      | AUR-801 | 68,50 | 900.000 |          | sim     |
    Quando "Paula" publica a importação
    Então "AUR-801" fica "reservado"

  Cenário: Descartar o rascunho não muda nada
    Dado um rascunho do "Residencial Aurora" com as linhas:
      | código  | área  | preço   | situação   | revisar |
      | AUR-502 | 68,50 | 999.000 | disponível | não     |
    Quando "Paula" descarta a importação
    Então "AUR-502" continua com o preço "765.000"
    E publicar de novo é recusado

  Cenário: Corretora não importa nem publica
    Dado um rascunho do "Residencial Aurora" com as linhas:
      | código  | área  | preço   | situação   | revisar |
      | AUR-502 | 68,50 | 999.000 | disponível | não     |
    Quando "Marina" tenta importar e publicar
    Então o banco recusa as duas
    E "AUR-502" continua com o preço "765.000"

  Cenário: Gestor de outra imobiliária não vê nem publica o rascunho
    Dado um rascunho do "Residencial Aurora" com as linhas:
      | código  | área  | preço   | situação   | revisar |
      | AUR-502 | 68,50 | 999.000 | disponível | não     |
    E a imobiliária "Alfa" com o gestor "Otávio"
    Quando "Otávio" tenta ver e publicar a importação
    Então ele não vê o rascunho e o banco recusa a publicação
