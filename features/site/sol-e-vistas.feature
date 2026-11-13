# language: pt
@site
Funcionalidade: Sol, noite, vistas e destaque no espelho de vendas
  O visitante vê o prédio com o sol de verdade (pela localização da ficha e pela hora que
  escolhe), à noite com as janelas acesas, de vistas prontas, e pode destacar só as disponíveis.

  Contexto:
    Dado o empreendimento em São Paulo

  Cenário: Ao meio-dia de inverno o sol fica alto e ao norte
    Quando a hora escolhida é 12h de "2026-06-21"
    Então o sol está acima do horizonte e vem do norte

  Cenário: De manhã o sol vem do leste
    Quando a hora escolhida é 8h de "2026-06-21"
    Então o sol vem do leste

  Cenário: À noite as janelas acendem
    Quando a hora escolhida é 22h de "2026-06-21"
    Então é noite e as unidades brilham mais que de dia

  Cenário: Sem localização na ficha, o sol não é inventado
    Dado o empreendimento sem localização na ficha
    Quando a hora escolhida é 22h de "2026-06-21"
    Então o sol fica na posição padrão de dia e não há controle de hora

  Cenário: Vistas prontas enquadram o prédio
    Dado um prédio de 10 andares
    Quando o visitante escolhe a vista "Frente"
    Então a câmera fica na frente do prédio, olhando para o meio dele
    E as vistas são "Aérea", "Frente", "Lateral", "Fundos" e "Cobertura"

  Cenário: Destacar só as disponíveis apaga as outras
    Quando o visitante liga "Só disponíveis"
    Então a unidade "available" continua com a cor do status
    E a unidade "sold" fica apagada
