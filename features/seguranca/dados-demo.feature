# language: pt
@seguranca
Funcionalidade: Dados de demonstração
  Demonstração nunca se mistura com informação real: toda linha demo é marcada.

  Cenário: O seed de demonstração marca tudo como demo
    Quando o seed de demonstração roda
    Então toda linha criada está marcada como demonstração
    E existe o empreendimento "Residencial Aurora" com 40 unidades

  Cenário: A unidade de exemplo tem os números do protótipo
    Quando o seed de demonstração roda
    Então a unidade "AUR-502" tem 82 m² e preço "765000.00"

  Cenário: Rodar o seed duas vezes não duplica
    Quando o seed de demonstração roda duas vezes
    Então existe apenas uma organização de demonstração

  Cenário: Limpar a demonstração preserva os dados reais
    Dado a organização real "Horizonte" com o lead "Ana"
    E o seed de demonstração rodou
    Quando a demonstração é removida
    Então nenhuma linha de demonstração resta
    E a organização "Horizonte" e o lead "Ana" continuam
