# language: pt
@seguranca
Funcionalidade: Logo da imobiliária no Storage
  O logo fica num bucket público (o site mostra para qualquer visitante), mas só o gestor grava,
  e só na pasta da própria imobiliária.

  Contexto:
    Dado as imobiliárias "Horizonte" e "Alfa"
    E a "Horizonte" com a gestora "Paula" e a corretora "Marina"

  Cenário: Gestora grava o logo na pasta da própria imobiliária
    Quando "Paula" grava o arquivo "logo.png" na pasta da "Horizonte"
    Então o arquivo fica gravado

  Cenário: Gestora não grava na pasta de outra imobiliária
    Quando "Paula" grava o arquivo "logo.png" na pasta da "Alfa"
    Então o Storage recusa

  Cenário: Corretora não grava o logo
    Quando "Marina" grava o arquivo "logo.png" na pasta da "Horizonte"
    Então o Storage recusa

  Cenário: Pasta que não é de imobiliária é recusada
    Quando "Paula" grava o arquivo "logo.png" na pasta "qualquer-coisa"
    Então o Storage recusa
