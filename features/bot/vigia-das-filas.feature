# language: pt
@bot
Funcionalidade: Vigia das filas do bot
  A operação precisa saber quando o bot para de atender. A cada minuto o vigia olha as filas:
  mensagem esperando mais de 60 s, falha nova ou Redis fora do ar viram alerta. O mesmo alerta
  não se repete enquanto o problema continua; quando volta ao normal, avisa que normalizou.

  Cenário: Mensagem parada há mais de 60 s gera alerta
    Dado a fila "inbound" com uma mensagem esperando há 75 segundos
    Quando o vigia confere as filas
    Então a operação recebe o alerta "Fila inbound parada: mensagem esperando há 75 s"

  Cenário: Mensagem esperando há menos de 60 s não gera alerta
    Dado a fila "inbound" com uma mensagem esperando há 20 segundos
    Quando o vigia confere as filas
    Então a operação não recebe alerta

  Cenário: Falha nova numa fila gera alerta uma vez
    Dado a fila "transcribe" com 2 falhas
    E o vigia já conferiu as filas
    Quando a fila "transcribe" passa a ter 3 falhas
    E o vigia confere as filas
    E o vigia confere as filas de novo
    Então a operação recebe só o alerta "Fila transcribe: 1 falha nova (3 no total)"

  Cenário: Problema que continua não repete o alerta e a volta ao normal é avisada
    Dado a fila "inbound" com uma mensagem esperando há 75 segundos
    E o vigia já conferiu as filas
    Quando a fila "inbound" volta a andar
    E o vigia confere as filas
    Então a operação recebe só o alerta "Fila inbound normalizada"

  Cenário: Redis fora do ar gera alerta
    Dado o Redis fora do ar
    Quando o vigia confere as filas
    Então a operação recebe o alerta "Redis fora do ar: o bot não consegue ler as filas"
