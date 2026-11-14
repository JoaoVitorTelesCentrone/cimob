# language: pt
@seguranca
Funcionalidade: O que o gestor pode mudar numa unidade pelo app
  Pelo CRM o gestor muda andar, posição, área, quartos, vagas, preço, status e planta. Código,
  empreendimento e imobiliária da unidade não mudam pelo app (mudar o código desligaria o
  objeto do 3D e os leads que citam a unidade).

  Contexto:
    Dado a imobiliária "Horizonte" com a gestora "Paula" e a corretora "Marina"
    E a unidade "AUR-502" do empreendimento "Aurora" com preço "765000"

  Cenário: Gestora edita a ficha da unidade
    Quando "Paula" muda o preço para "780000", a área para "70" e o andar para "5"
    Então a unidade "AUR-502" fica com preço "780000", área "70" e andar "5"

  Cenário: Gestora não muda código, empreendimento nem imobiliária da unidade
    Quando "Paula" tenta mudar o código, o empreendimento e a imobiliária da unidade
    Então o banco recusa nas três

  Cenário: Corretora não edita a unidade
    Quando "Marina" muda o preço para "1", a área para "1" e o andar para "1"
    Então a unidade "AUR-502" fica com preço "765000", área "" e andar ""
