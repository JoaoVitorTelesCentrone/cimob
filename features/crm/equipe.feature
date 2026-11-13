# language: pt
@crm
Funcionalidade: Equipe e rodízio no CRM
  O gestor vê quem está no rodízio, quem é o próximo da vez e como cada um está indo.
  Lead sem dono pode ser distribuído pela ficha.

  Contexto:
    Dado agora são "2026-11-12 15:00"
    E a equipe:
      | nome   | papel     | rodízio |
      | Paula  | org_admin | não     |
      | Marina | agent     | sim     |
      | Rafael | agent     | sim     |
      | Sofia  | agent     | não     |
    E os leads da equipe:
      | nome        | estágio    | corretor | atribuído às     | respondido às    | chegou em        |
      | Ana Ribeiro | new        | Marina   | 2026-11-12 12:00 |                  | 2026-11-12 11:50 |
      | Bruno Lima  | visit_done | Marina   | 2026-11-10 10:00 | 2026-11-10 10:10 | 2026-11-10 09:55 |
      | Carla Souza | proposal   | Rafael   | 2026-11-05 09:00 | 2026-11-05 09:30 | 2026-11-05 08:50 |

  Cenário: A equipe mostra papel, rodízio e desempenho dos últimos 30 dias
    Quando o gestor abre a equipe com "Rafael" como próximo da vez
    Então a equipe é:
      | nome   | papel    | rodízio | próximo | leads | 1ª resposta | visitas | propostas | atrasados |
      | Marina | Corretor | sim     | não     | 2     | 10 min      | 1       | 0         | 1         |
      | Paula  | Gestor   | não     | não     | 0     | –           | 0       | 0         | 0         |
      | Rafael | Corretor | sim     | sim     | 1     | 30 min      | 1       | 1         | 0         |
      | Sofia  | Corretor | não     | não     | 0     | –           | 0       | 0         | 0         |

  Cenário: Ninguém no rodízio gera aviso
    Dado ninguém está no rodízio
    Quando o gestor abre a equipe sem próximo da vez
    Então vejo o aviso "Ninguém no rodízio: leads novos ficam sem dono até alguém entrar."

  Esquema do Cenário: Só gestor muda o rodízio e distribui leads
    Então quem tem o papel "<papel>" <pode> mudar o rodízio e distribuir leads

    Exemplos:
      | papel        | pode     |
      | org_admin    | pode     |
      | agency_admin | pode     |
      | agent        | não pode |

  Cenário: Pedido de mudança de rodízio inválido é recusado
    Quando chega o pedido de rodízio "usuario=xyz&rodizio=talvez"
    Então o pedido é recusado

  Cenário: Distribuir pela ficha avisa quem recebeu
    Quando o rodízio entrega o lead para "Marina"
    Então vejo a mensagem "Lead atribuído a Marina"

  Cenário: Distribuir sem ninguém no rodízio avisa o gestor
    Quando o rodízio não encontra ninguém
    Então vejo a mensagem "Ninguém no rodízio. Coloque alguém na Equipe e tente de novo."

  Esquema do Cenário: WhatsApp do corretor é conferido antes de salvar
    Quando o gestor informa o WhatsApp "<digitado>"
    Então o número salvo é "<salvo>"

    Exemplos:
      | digitado            | salvo         |
      | (11) 91111-0000     | 5511911110000 |
      | +55 11 91111-0000   | 5511911110000 |
      | 11 3333-4444        | 551133334444  |
      |                     | nenhum        |

  Cenário: WhatsApp inválido é recusado
    Quando o gestor informa o WhatsApp "123"
    Então vejo o erro "Número inválido. Use DDD e número, ex.: (11) 91234-5678"
