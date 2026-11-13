# language: pt
@bot
Funcionalidade: Gasto de anúncios da Meta
  O bot importa da Marketing API o gasto por anúncio de cada imobiliária, regravando os
  últimos 7 dias a cada rodada (a Meta ajusta os valores depois), para o painel mostrar
  quanto custaram o lead e a visita. O lead que chega por um anúncio (click-to-WhatsApp)
  já nasce ligado a ele.

  Contexto:
    Dado a imobiliária "Horizonte" com a conta de anúncios "act_111" e o token guardado no cofre
    E a imobiliária "Alfa" com a conta de anúncios "act_222" e sem token próprio
    E a imobiliária "Beta" sem conta de anúncios

  Cenário: Importar o gasto recente por anúncio
    Dado a Meta responde o gasto de "act_111":
      | data       | anúncio | campanha | gasto  | impressões | cliques |
      | 2026-11-12 | ad_1    | camp_9   | 120,50 | 4000       | 55      |
      | 2026-11-11 | ad_1    | camp_9   | 98,00  | 3100       | 40      |
      | 2026-11-11 | ad_2    | camp_9   | 30,00  | 900        | 8       |
    Quando a importação de gasto roda
    Então o gasto diário da "Horizonte" é:
      | data       | anúncio | campanha | gasto  | impressões | cliques |
      | 2026-11-12 | ad_1    | camp_9   | 120,50 | 4000       | 55      |
      | 2026-11-11 | ad_1    | camp_9   | 98,00  | 3100       | 40      |
      | 2026-11-11 | ad_2    | camp_9   | 30,00  | 900        | 8       |
    E a "Beta" não gerou chamada à Meta

  Cenário: A importação usa o token da imobiliária, e o token não aparece em logs nem alertas
    Dado a Meta responde o gasto de "act_111":
      | data       | anúncio | campanha | gasto  | impressões | cliques |
      | 2026-11-12 | ad_1    | camp_9   | 120,50 | 4000       | 55      |
    Quando a importação de gasto roda
    Então a Meta recebeu a chamada de "act_111" com o token da "Horizonte"
    E o token não aparece em nenhum log nem alerta

  Cenário: Conta sem token próprio usa o token do ambiente
    Dado a Meta responde o gasto de "act_222":
      | data       | anúncio | campanha | gasto | impressões | cliques |
      | 2026-11-12 | ad_7    | camp_3   | 40,00 | 1200       | 15      |
    Quando a importação de gasto roda
    Então a Meta recebeu a chamada de "act_222" com o token do ambiente
    E o gasto diário da "Alfa" tem 1 linha

  Cenário: Reimportar o mesmo período corrige os valores sem duplicar
    Dado a Meta responde o gasto de "act_111":
      | data       | anúncio | campanha | gasto  | impressões | cliques |
      | 2026-11-12 | ad_1    | camp_9   | 120,50 | 4000       | 55      |
    Quando a importação de gasto roda
    E a Meta passa a responder o gasto de "act_111":
      | data       | anúncio | campanha | gasto  | impressões | cliques |
      | 2026-11-12 | ad_1    | camp_9   | 130,00 | 4100       | 57      |
    E a importação de gasto roda de novo
    Então o gasto diário da "Horizonte" é:
      | data       | anúncio | campanha | gasto  | impressões | cliques |
      | 2026-11-12 | ad_1    | camp_9   | 130,00 | 4100       | 57      |

  Cenário: Erro da Meta não derruba a importação nem grava nada
    Dado a Meta responde "erro interno" para "act_111"
    Quando a importação de gasto roda
    Então nenhum gasto é gravado
    E a operação recebe um alerta de falha de importação

  Cenário: Lead que chega por um anúncio nasce com origem e anúncio
    Quando o contato "5511987654321" manda "Olá! Código: AUR-502" pelo anúncio "ad_1" da "Horizonte"
    Então o lead de "5511987654321" nasce com a origem "meta_ads" e o anúncio "ad_1"

  Cenário: Lead que volta por outro anúncio passa a apontar para o último anúncio clicado
    Dado o contato "5511987654321" já é lead da "Horizonte" vindo do anúncio "ad_1"
    Quando o contato "5511987654321" manda "Ainda tenho interesse" pelo anúncio "ad_2" da "Horizonte"
    Então o lead de "5511987654321" fica com a origem "meta_ads" e o anúncio "ad_2"

  Cenário: Mensagem sem anúncio mantém a origem do WhatsApp
    Quando o contato "5511912345678" manda "Oi, vi o número de vocês" para a "Horizonte"
    Então o lead de "5511912345678" nasce com a origem "whatsapp" e sem anúncio
