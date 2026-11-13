# language: pt
@site
Funcionalidade: Marca white label da imobiliária
  Só a cor de marca muda por cliente. A cor precisa ser legível com o texto sobre ela.

  Cenário: Cor com bom contraste é mantida
    Quando a imobiliária escolhe a cor "#155F4B"
    Então a cor de marca é "#155F4B"
    E o texto sobre a marca tem contraste de pelo menos 4.5

  Esquema do Cenário: Cor clara demais é escurecida até ficar legível
    Quando a imobiliária escolhe a cor "<cor>"
    Então a cor de marca é mais escura que "<cor>"
    E o texto sobre a marca tem contraste de pelo menos 4.5

    Exemplos:
      | cor     |
      | #FFD700 |
      | #90EE90 |
      | #FFFF00 |

  Cenário: Só as variáveis de marca mudam
    Quando a imobiliária escolhe a cor "#D4145A"
    Então o tema define apenas "--brand", "--brand-strong", "--brand-soft" e "--on-brand"
    E as cores de status disponível, reservado e vendido continuam as mesmas do design system

  Cenário: Cor inválida é recusada
    Quando a imobiliária escolhe a cor "vermelho"
    Então o sistema recusa a cor com a mensagem "Cor inválida"
