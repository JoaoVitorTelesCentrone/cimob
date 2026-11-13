# language: pt
@site
Funcionalidade: Card da unidade no espelho de vendas
  Ao escolher uma unidade (no prédio ou na lista), o visitante vê os dados da ficha e chama
  a imobiliária no WhatsApp com o código da unidade, que o bot reconhece.

  Contexto:
    Dado o "Residencial Aurora" da imobiliária com WhatsApp "5511900000000"

  Cenário: Unidade disponível mostra os dados da ficha e o "Quero essa"
    Quando o visitante escolhe a unidade "AUR-502" do 5º andar, com 82 m², 3 dormitórios, 2 vagas, R$ 765.000 e "available"
    Então o card mostra o título "Unidade 502" e o status "Disponível"
    E o card mostra "AUR-502", "82 m²", "3 dormitórios", "2 vagas", "5º andar" e "R$ 765.000"
    E o botão "Quero essa" abre o WhatsApp com "Olá! Vi a unidade 502 do Residencial Aurora no site e quero saber mais. Código: AUR-502"

  Esquema do Cenário: Unidade que não está disponível não mostra preço e oferece parecidas
    Quando o visitante escolhe a unidade "AUR-703" do 7º andar, com 120 m², 4 dormitórios, 3 vagas, R$ 990.000 e "<status>"
    Então o card mostra o título "Unidade 703" e o status "<rótulo>"
    E o card não mostra preço
    E o botão "Ver parecidas" abre o WhatsApp com "Olá! Vi que a unidade 703 do Residencial Aurora está <situação>. Quero ver opções parecidas. Código: AUR-703"

    Exemplos:
      | status   | rótulo    | situação  |
      | sold     | Vendido   | vendida   |
      | reserved | Reservado | reservada |

  Cenário: Unidade sem preço na ficha não inventa preço
    Quando o visitante escolhe a unidade "AUR-101" do 1º andar, sem preço e sem quartos na ficha
    Então o card não mostra preço
    E o card não fala de dormitórios

  Cenário: Sem WhatsApp cadastrado, o card não tem botão
    Dado a imobiliária está sem WhatsApp
    Quando o visitante escolhe a unidade "AUR-502" do 5º andar, com 82 m², 3 dormitórios, 2 vagas, R$ 765.000 e "available"
    Então o card não tem botão de WhatsApp
