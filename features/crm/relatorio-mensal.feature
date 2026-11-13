# language: pt
@crm
Funcionalidade: Relatório mensal da imobiliária
  Todo mês a Center One mostra ao cliente o que os anúncios e a equipe entregaram: funil,
  custo e desempenho por corretor, cada número comparado com o mês anterior. Os leads contam
  pelo mês em que chegaram (como no painel); o gasto, pelos dias do mês. Só o gestor e a
  Center One veem (tem investimento e desempenho por corretor).

  Contexto:
    Dado os leads da imobiliária:
      | nome        | origem       | estágio    | qualificado | corretor | chegou em        | 1ª resposta em   |
      | Ana Ribeiro | Anúncio Meta | visit_done | sim         | Marina   | 2026-11-03 10:00 | 2026-11-03 10:20 |
      | Bruno Lima  | Anúncio Meta | won        | sim         | Marina   | 2026-11-10 09:00 | 2026-11-10 12:30 |
      | Carla Souza | Site         | qualified  | sim         | Rafael   | 2026-11-20 14:00 |                  |
      | Diego Alves | Anúncio Meta | new        | não         |          | 2026-11-28 08:00 |                  |
      | Érica Nunes | Anúncio Meta | visit_done | sim         | Rafael   | 2026-10-15 11:00 | 2026-10-15 11:10 |
      | Hugo Prado  | Site         | lost       | não         | Marina   | 2026-10-22 16:00 | 2026-10-22 16:30 |
    E o gasto em anúncios:
      | data       | gasto  |
      | 2026-11-05 | 300,00 |
      | 2026-11-18 | 300,00 |
      | 2026-10-10 | 200,00 |
      | 2026-09-30 | 999,00 |

  Cenário: Funil do mês com a variação contra o mês anterior
    Quando gero o relatório de "2026-11"
    Então o funil do relatório é:
      | indicador    | mês | mês anterior |
      | Leads        | 4   | 2            |
      | Qualificados | 3   | 1            |
      | Visitas      | 2   | 1            |
      | Propostas    | 1   | 0            |
      | Ganhos       | 1   | 0            |

  Cenário: Custo do mês só com os leads e o gasto do próprio mês
    Quando gero o relatório de "2026-11"
    Então o custo do relatório é:
      | indicador        | mês    | mês anterior |
      | Investimento     | 600,00 | 200,00       |
      | CPL              | 200,00 | 200,00       |
      | Custo por visita | 300,00 | 200,00       |

  Cenário: Desempenho por corretor no mês
    Quando gero o relatório de "2026-11"
    Então o relatório por corretor é:
      | corretor | leads | 1ª resposta (mediana) | visitas | respostas atrasadas |
      | Marina   | 2     | 115 min               | 2       | 1                   |
      | Rafael   | 1     | –                     | 0       | 1                   |

  Cenário: Por origem no mês
    Quando gero o relatório de "2026-11"
    Então o relatório por origem é:
      | origem       | leads | qualificados | visitas |
      | Anúncio Meta | 3     | 2            | 2       |
      | Site         | 1     | 1            | 0       |

  Cenário: Mês sem gasto não fala de custo
    Quando gero o relatório de "2026-08"
    Então o relatório não tem custo
    E o funil do relatório tem 0 leads
