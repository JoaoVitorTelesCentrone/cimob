# language: pt
@site
Funcionalidade: Escolher a unidade direto no prédio 3D
  Clicar num bloco escolhe a unidade; passar o mouse destaca. Funciona com o prédio montado
  pela ficha e com o modelo do arquiteto.

  Contexto:
    Dado o prédio com as unidades "AUR-101", "AUR-102" e "AUR-201"

  Cenário: Clicar num bloco escolhe a unidade
    Quando o visitante clica no bloco "AUR-102"
    Então a unidade escolhida é "AUR-102"

  Cenário: Passar o mouse destaca o bloco
    Quando o visitante passa o mouse no bloco "AUR-201"
    Então o bloco "AUR-201" fica destacado
    E o bloco "AUR-101" não fica destacado

  Cenário: A unidade escolhida fica destacada
    Dado a unidade "AUR-101" está escolhida
    Então o bloco "AUR-101" fica destacado

  Cenário: "Só disponíveis" apaga no prédio as que não estão à venda
    Dado a unidade "AUR-102" está vendida
    Quando o visitante liga "Só disponíveis" no prédio
    Então o bloco "AUR-102" fica apagado
    E o bloco "AUR-101" não fica apagado
