# language: pt
@site
Funcionalidade: Modelo 3D do arquiteto ligado às unidades
  Com o GLB do arquiteto, cada objeto cujo nome bate com o `mesh_name` da ficha vira a unidade:
  pinta com o status e responde ao clique. O resto do modelo (fachada, lajes) fica como veio.

  Contexto:
    Dado o modelo com os objetos "AUR-101", "AUR-102", "Fachada" e "Laje"
    E as unidades da ficha:
      | código  | mesh_name | status    |
      | AUR-101 | AUR-101   | available |
      | AUR-102 | AUR-102   | sold      |
      | AUR-103 | AUR-103   | reserved  |
      | AUR-104 |           | available |

  Cenário: Objeto com o nome da unidade vira a unidade
    Quando o modelo é ligado à ficha
    Então o objeto "AUR-101" é a unidade "AUR-101" com a cor "#16A34A"
    E o objeto "AUR-102" é a unidade "AUR-102" com a cor "#8B93A1"

  Cenário: O resto do modelo fica como veio
    Quando o modelo é ligado à ficha
    Então os objetos "Fachada" e "Laje" não são unidades

  Cenário: Unidade que não está no modelo fica fora do prédio
    Quando o modelo é ligado à ficha
    Então "AUR-103" e "AUR-104" ficam na lista de unidades fora do prédio
