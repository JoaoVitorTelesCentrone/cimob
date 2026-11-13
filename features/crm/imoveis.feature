# language: pt
@crm
Funcionalidade: Imóveis e status das unidades no CRM
  O gestor mantém o estoque em dia: o que muda aqui muda no site e no espelho 3D.
  As cores de status são fixas e não seguem a marca do cliente.

  Contexto:
    Dado as unidades do empreendimento "Aurora":
      | código  | andar | área  | quartos | preço     | status    |
      | AUR-1201 | 12    | 82.50 | 3       | 950000.00 | available |
      | AUR-502 | 5     | 64.00 | 2       | 610000.00 | reserved  |
      | AUR-503 | 5     | 64.00 | 2       |           | sold      |
      | AUR-101 | 1     | 58.00 | 2       | 520000.00 | available |

  Cenário: Unidades em ordem de andar e código, com status em português
    Quando abro os imóveis
    Então as unidades de "Aurora" são:
      | código   | andar | área     | preço           | status     |
      | AUR-101  | 1º    | 58 m²    | R$ 520.000      | Disponível |
      | AUR-502  | 5º    | 64 m²    | R$ 610.000      | Reservado  |
      | AUR-503  | 5º    | 64 m²    | —               | Vendido    |
      | AUR-1201 | 12º   | 82,5 m²  | R$ 950.000      | Disponível |
    E o resumo de "Aurora" é "2 disponíveis · 1 reservada · 1 vendida"

  Cenário: Filtro por status
    Quando filtro os imóveis pelo status "available"
    Então aparecem só "AUR-101" e "AUR-1201"

  Esquema do Cenário: As cores de status são fixas
    Então o status "<status>" usa a cor "<cor>"

    Exemplos:
      | status    | cor       |
      | available | available |
      | reserved  | reserved  |
      | sold      | sold      |

  Cenário: Gestor muda o status
    Quando o gestor muda "AUR-101" de "available" para "reserved"
    Então a mudança de status é aceita para "reserved"

  Cenário: Escolher o mesmo status não salva nada
    Quando o gestor muda "AUR-101" de "available" para "available"
    Então nada é salvo no estoque

  Cenário: Status inexistente é recusado
    Quando o gestor muda "AUR-101" de "available" para "demolido"
    Então vejo o erro de estoque "Status inválido"

  Cenário: Corretor não muda o status
    Quando o corretor muda "AUR-101" de "available" para "sold"
    Então vejo o erro de estoque "Só o gestor muda o status"

  Cenário: Unidade alterada por outra pessoa no meio do caminho
    Dado outra pessoa já marcou "AUR-101" como "sold"
    Quando o gestor muda "AUR-101" de "available" para "reserved"
    Então vejo o erro de estoque "Esta unidade foi alterada por outra pessoa. Atualize a página."

  Cenário: Mudanças de outras pessoas atualizam a tela sozinhas
    Dado a tela está aberta e escutando mudanças
    Quando chegam 5 mudanças em menos de 1 segundo
    Então a tela recarrega os dados 1 vez

  Cenário: A tela só escuta a própria imobiliária
    Quando a tela de imóveis da imobiliária "org-horizonte" começa a escutar
    Então ela escuta "units" e "properties" filtrando "organization_id=eq.org-horizonte"
