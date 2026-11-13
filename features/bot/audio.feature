# language: pt
@bot
Funcionalidade: Lead que manda áudio
  Áudio de até 60 s é transcrito e entra na conversa como se fosse digitado.
  Áudio longo vai para o corretor; se a transcrição falhar, o bot pede para digitar.

  Contexto:
    Dado uma conversa em andamento sobre "AUR-502" aguardando a faixa de investimento

  Cenário: Áudio curto é transcrito e entendido
    Quando o contato envia um áudio de 12 segundos dizendo "uns setecentos mil, mais ou menos"
    Então o áudio é transcrito
    E a faixa "R$ 600–800 mil" é registrada
    E o bot segue para a pergunta de prazo

  Cenário: Áudio não responde o bot antes de ser transcrito
    Quando o contato envia um áudio de 12 segundos dizendo "uns setecentos mil, mais ou menos"
    Então antes da transcrição o bot não responde nada
    E a transcrição fica na fila

  Cenário: Áudio longo vai para o corretor
    Quando o contato envia um áudio de 3 minutos
    Então o bot avisa que vai passar para o corretor
    E o lead é atribuído com a marcação "áudio longo"

  Cenário: Falha na transcrição pede texto
    Dado o serviço de transcrição está fora do ar
    Quando o contato envia um áudio de 10 segundos
    Então o bot pede para o contato digitar a resposta
    E um alerta é enviado ao grupo de operação

  Cenário: Falha ao baixar o áudio da Meta também pede texto
    Dado a Meta não entrega o arquivo do áudio
    Quando o contato envia um áudio de 10 segundos
    Então o bot pede para o contato digitar a resposta
    E um alerta é enviado ao grupo de operação
