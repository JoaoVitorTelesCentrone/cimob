# language: pt
@site
Funcionalidade: Status das unidades ao vivo no site
  O gestor muda o status no CRM e o site aberto muda junto, sem recarregar.
  Só valem mudanças de unidades do empreendimento na tela, com status conhecido.

  Contexto:
    Dado o site mostrando a unidade "AUR-502" disponível por R$ 765.000

  Cenário: Unidade reservada no CRM muda no site
    Quando chega do Realtime que "AUR-502" ficou "reserved"
    Então o card de "AUR-502" mostra "Reservado", sem preço e com "Ver parecidas"

  Cenário: Mudança de unidade que não está na tela não mexe no card
    Quando chega do Realtime que "XYZ-1" ficou "sold"
    Então o card de "AUR-502" continua "Disponível"

  Cenário: Status desconhecido é ignorado
    Quando chega do Realtime que "AUR-502" ficou "demolido"
    Então o card de "AUR-502" continua "Disponível"
