# language: pt
@crm
Funcionalidade: Custo de marketing no painel
  O gestor vê quanto a imobiliária investiu nos anúncios da Meta e quanto custaram o lead
  e a visita vindos de anúncio, no mesmo período dos outros indicadores. Sem gasto
  importado o painel não fala de custo; e o corretor nunca vê valores de investimento.

  Contexto:
    Dado agora são "2026-11-12 15:00"
    E os leads do painel:
      | nome        | origem       | estágio    | qualificado | chegou em        |
      | Ana Ribeiro | Anúncio Meta | new        | não         | 2026-11-12 11:50 |
      | Bruno Lima  | Anúncio Meta | qualified  | sim         | 2026-11-11 09:55 |
      | Carla Souza | Anúncio Meta | visit_done | sim         | 2026-11-06 08:50 |
      | Diego Alves | Site         | visit_done | sim         | 2026-11-03 08:30 |
      | Érica Nunes | Anúncio Meta | won        | sim         | 2026-10-20 08:00 |
      | Hugo Prado  | Anúncio Meta | won        | sim         | 2026-09-01 08:00 |
    E o gasto importado da Meta:
      | data       | gasto  |
      | 2026-11-12 | 50,00  |
      | 2026-11-10 | 100,00 |
      | 2026-11-08 | 150,00 |
      | 2026-11-01 | 200,00 |
      | 2026-10-20 | 300,00 |

  Cenário: Investimento, CPL e custo por visita dos últimos 30 dias
    Quando abro o painel dos últimos 30 dias
    Então os indicadores de custo são:
      | indicador        | valor     | detalhe            |
      | Investimento     | R$ 800,00 | em anúncios Meta   |
      | CPL              | R$ 200,00 | 4 leads de anúncio |
      | Custo por visita | R$ 400,00 | 2 visitas de anúncio |

  Cenário: O período muda o custo
    Quando abro o painel dos últimos 7 dias
    Então os indicadores de custo são:
      | indicador        | valor     | detalhe            |
      | Investimento     | R$ 300,00 | em anúncios Meta   |
      | CPL              | R$ 100,00 | 3 leads de anúncio |
      | Custo por visita | R$ 300,00 | 1 visita de anúncio |

  Cenário: Por origem mostra o custo só da linha de anúncio
    Quando abro o painel dos últimos 30 dias
    Então a tabela por origem com custo é:
      | origem       | leads | qualificados | visitas | investimento | CPL       | custo por visita |
      | Anúncio Meta | 4     | 3            | 2       | R$ 800,00    | R$ 200,00 | R$ 400,00        |
      | Site         | 1     | 1            | 1       | –            | –         | –                |

  Cenário: Sem lead de anúncio no período, CPL e custo por visita ficam vazios
    Dado o painel sem leads
    Quando abro o painel dos últimos 30 dias
    Então os indicadores de custo são:
      | indicador        | valor     | detalhe            |
      | Investimento     | R$ 800,00 | em anúncios Meta   |
      | CPL              | –         | 0 leads de anúncio |
      | Custo por visita | –         | 0 visitas de anúncio |

  Cenário: Sem gasto importado o painel não fala de custo
    Dado o painel sem gasto importado
    Quando abro o painel dos últimos 30 dias
    Então não há indicadores de custo
    E a tabela por origem não tem colunas de custo
