# language: pt
@site
Funcionalidade: Prédio 3D gerado a partir das unidades
  Sem o modelo do arquiteto, o espelho de vendas monta o prédio a partir da ficha:
  cada unidade vira um bloco no andar dela, com a cor do status.

  Contexto:
    Dado as unidades do empreendimento:
      | código  | andar | posição | status    |
      | AUR-101 | 1     | 01      | available |
      | AUR-102 | 1     | 02      | reserved  |
      | AUR-103 | 1     | 03      | sold      |
      | AUR-104 | 1     | 04      | available |
      | AUR-201 | 2     | 01      | available |
      | AUR-202 | 2     | 02      | available |
      | AUR-203 | 2     | 03      | available |
      | AUR-204 | 2     | 04      | available |
      | AUR-T01 |       | 01      | available |

  Cenário: Cada unidade com andar vira um bloco com o código dela
    Quando o prédio é montado
    Então o prédio tem 2 andares e 8 blocos
    E o bloco "AUR-502" não existe
    E o bloco "AUR-201" fica um andar acima do bloco "AUR-101"

  Cenário: Unidades do mesmo andar não se sobrepõem
    Quando o prédio é montado
    Então nenhum bloco do mesmo andar encosta em outro

  Cenário: Unidade sem andar na ficha fica fora do prédio
    Quando o prédio é montado
    Então "AUR-T01" fica na lista de unidades fora do prédio

  Esquema do Cenário: As cores de status são fixas e não seguem a marca
    Quando o prédio é montado com a cor de marca "#D4145A"
    Então o bloco "<código>" tem a cor "<cor>"

    Exemplos:
      | código  | cor     |
      | AUR-101 | #16A34A |
      | AUR-102 | #F59E0B |
      | AUR-103 | #8B93A1 |

  Cenário: O prédio cresce com o número de andares
    Dado um empreendimento com 10 andares de 4 unidades
    Quando o prédio é montado
    Então a cobertura fica acima do 10º andar
