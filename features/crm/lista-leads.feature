# language: pt
@crm
Funcionalidade: Lista de leads do CRM
  O gestor e o corretor encontram rápido quem precisa de atenção: atrasados primeiro.

  Contexto:
    Dado agora são "2026-11-12 15:00"
    E os leads:
      | nome         | telefone      | estágio   | corretor | atribuído às     | respondido |
      | Ana Ribeiro  | 5511999990001 | new       | Marina   | 2026-11-12 12:00 | não        |
      | Bruno Lima   | 5511999990002 | contacted | Marina   | 2026-11-12 14:30 | não        |
      | Carla Souza  | 5521988880003 | qualified | Rafael   | 2026-11-12 09:00 | sim        |
      | Diego Alves  | 5511977770004 | lost      | Rafael   | 2026-11-11 09:00 | não        |
      | Érica Nunes  | 5511966660005 | new       |          |                  | não        |

  Cenário: Atrasados aparecem primeiro
    Quando abro a lista de leads
    Então o primeiro lead é "Ana Ribeiro"
    E "Ana Ribeiro" aparece como atrasado

  Esquema do Cenário: Quando um lead está atrasado
    Então "<nome>" <situação>

    Exemplos:
      | nome        | situação               |
      | Ana Ribeiro | está atrasado          |
      | Bruno Lima  | não está atrasado      |
      | Carla Souza | não está atrasado      |
      | Diego Alves | não está atrasado      |
      | Érica Nunes | não está atrasado      |

  Cenário: Busca pelo nome ignora acentos e maiúsculas
    Quando busco por "erica"
    Então a lista mostra só "Érica Nunes"

  Cenário: Busca pelo telefone usa só os dígitos
    Quando busco por "(21) 98888-0003"
    Então a lista mostra só "Carla Souza"

  Cenário: Filtro por estágio
    Quando filtro pelo estágio "new"
    Então a lista mostra "Ana Ribeiro" e "Érica Nunes"

  Cenário: Filtro só de atrasados
    Quando filtro só os atrasados
    Então a lista mostra só "Ana Ribeiro"

  Cenário: Filtro por corretor
    Quando filtro pelo corretor "Rafael"
    Então a lista mostra "Carla Souza" e "Diego Alves"

  Cenário: Ordenar por nome mantém os atrasados no topo
    Quando ordeno por nome
    Então a ordem é "Ana Ribeiro", "Bruno Lima", "Carla Souza", "Diego Alves", "Érica Nunes"

  Cenário: Parâmetros inválidos no endereço são ignorados
    Quando abro a lista com o endereço "?stage=xyz&sort=hack&late=talvez"
    Então a lista mostra os 5 leads

  Cenário: Botão do WhatsApp abre a conversa com o lead
    Quando abro a ficha de "Carla Souza"
    Então o botão do WhatsApp aponta para "https://wa.me/5521988880003"

  Esquema do Cenário: Estágios aparecem em português
    Então o estágio "<estágio>" aparece como "<rótulo>"

    Exemplos:
      | estágio         | rótulo          |
      | new             | Novo            |
      | qualified       | Qualificado     |
      | contacted       | Em atendimento  |
      | visit_scheduled | Visita agendada |
      | visit_done      | Visita feita    |
      | proposal        | Proposta        |
      | won             | Ganho           |
      | lost            | Perdido         |
