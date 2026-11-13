# language: pt
@crm
Funcionalidade: Painel do CRM
  O gestor vê, num lugar só, do anúncio à visita: quantos leads chegaram, quantos viraram
  visita e negócio, quanto o time demora para responder e quem está atrasado.

  Contexto:
    Dado agora são "2026-11-12 15:00"
    E os leads do painel:
      | nome          | origem       | estágio         | qualificado | corretor | atribuído às     | respondido às    | chegou em        |
      | Ana Ribeiro   | Anúncio Meta | new             | não         | Marina   | 2026-11-12 12:00 |                  | 2026-11-12 11:50 |
      | Bruno Lima    | Anúncio Meta | qualified       | sim         | Marina   | 2026-11-12 10:00 | 2026-11-12 10:10 | 2026-11-12 09:55 |
      | Carla Souza   | Site         | visit_done      | sim         | Rafael   | 2026-11-10 09:00 | 2026-11-10 09:30 | 2026-11-10 08:50 |
      | Diego Alves   | Site         | proposal        | sim         | Rafael   | 2026-11-06 09:00 | 2026-11-06 09:20 | 2026-11-06 08:30 |
      | Érica Nunes   | Indicação    | won             | sim         | Marina   | 2026-10-20 09:00 | 2026-10-20 09:05 | 2026-10-20 08:00 |
      | Fábio Correia | Anúncio Meta | lost            | sim         | Rafael   | 2026-11-01 09:00 | 2026-11-01 11:00 | 2026-11-01 08:00 |
      | Gabriela Dias |              | new             |             |          |                  |                  | 2026-11-12 14:00 |
      | Hugo Prado    | Anúncio Meta | won             | sim         | Rafael   | 2026-09-01 09:00 | 2026-09-01 09:10 | 2026-09-01 08:00 |

  Cenário: KPIs dos últimos 30 dias
    Quando abro o painel dos últimos 30 dias
    Então os indicadores são:
      | indicador             | valor  | detalhe                     |
      | Leads                 | 7      | no período                  |
      | Qualificados          | 5      | 71% dos leads               |
      | 1ª resposta (mediana) | 20 min | após atribuição             |
      | Visitas feitas        | 3      | 60% dos qualificados        |
      | Propostas             | 2      | em andamento ou fechadas    |
      | Negócios ganhos       | 1      | registrados pelo corretor   |

  Cenário: O período muda os números
    Quando abro o painel dos últimos 7 dias
    Então o indicador "Leads" mostra "5"
    E o indicador "Negócios ganhos" mostra "0"

  Cenário: Período inválido no endereço volta para 30 dias
    Quando abro o painel com o endereço "?period=365"
    Então o período é de 30 dias

  Cenário: Funil do período conta quem passou por cada etapa
    Quando abro o painel dos últimos 30 dias
    Então o funil é:
      | etapa            | leads |
      | Leads            | 7     |
      | Qualificados     | 5     |
      | Em atendimento+  | 3     |
      | Visita agendada+ | 3     |
      | Visita feita+    | 3     |
      | Proposta+        | 2     |
      | Ganho            | 1     |

  Cenário: Por origem
    Quando abro o painel dos últimos 30 dias
    Então a tabela por origem é:
      | origem       | leads | qualificados | visitas |
      | Anúncio Meta | 3     | 2            | 0       |
      | Site         | 2     | 2            | 2       |
      | Indicação    | 1     | 1            | 1       |
      | Sem origem   | 1     | 0            | 0       |

  Cenário: Por corretor
    Quando abro o painel dos últimos 30 dias
    Então a tabela por corretor é:
      | corretor | leads | 1ª resposta | visitas | propostas | atrasados |
      | Marina   | 3     | 8 min       | 1       | 1         | 1         |
      | Rafael   | 3     | 30 min      | 2       | 1         | 0         |

  Cenário: Sem respostas no período a mediana fica vazia
    Dado nenhum lead foi respondido
    Quando abro o painel dos últimos 30 dias
    Então o indicador "1ª resposta (mediana)" mostra "–"

  Cenário: Alerta de atraso lista quem está esperando
    Quando abro o painel dos últimos 30 dias
    Então o painel mostra o alerta "1 lead sem primeira resposta há mais de 2 h: Ana Ribeiro"
    E o alerta leva para a lista só de atrasados

  Cenário: Sem atrasados não há alerta
    Dado "Ana Ribeiro" já foi respondida
    Quando abro o painel dos últimos 30 dias
    Então o painel não mostra alerta de atraso
