# language: pt
@bot
Funcionalidade: Passagem do lead ao corretor
  O corretor recebe o resumo no WhatsApp dele (modelo aprovado pela Meta, que funciona fora da
  janela de 24 h), avisa que já respondeu e, no dia seguinte, conta como o lead está.

  Contexto:
    Dado a imobiliária "Horizonte" com a corretora "Marina Alves" no rodízio e WhatsApp "5511911110000"
    E a unidade "AUR-502" disponível

  Cenário: Corretor recebe o resumo do lead qualificado
    Quando o lead "Ana Souza" termina a qualificação na faixa "R$ 600–800 mil" e pergunta "aceita pet?"
    Então "Marina Alves" recebe o modelo "novo_lead" com "Ana Souza", "AUR-502", "R$ 600–800 mil" e "aceita pet?"
    E o resumo tem o botão "Já respondi"

  Cenário: Corretor sem WhatsApp cadastrado fica registrado no histórico
    Dado "Marina Alves" está sem WhatsApp cadastrado
    Quando o lead "Ana Souza" termina a qualificação na faixa "R$ 600–800 mil" e pergunta "aceita pet?"
    Então nenhum resumo é enviado
    E o histórico de "Ana Souza" registra que o corretor não foi avisado

  Cenário: "Já respondi" registra a primeira resposta
    Dado o resumo de "Ana Souza" foi enviado a "Marina Alves"
    Quando "Marina Alves" toca em "Já respondi"
    Então a primeira resposta de "Ana Souza" fica registrada
    E "Marina Alves" recebe a confirmação "Anotado"
    E o número de "Marina Alves" não vira lead

  Cenário: Pergunta de estágio no dia seguinte
    Dado "Ana Souza" foi passada a "Marina Alves" há 25 horas
    Quando a rotina de acompanhamento roda
    Então "Marina Alves" recebe o modelo "atualizar_lead" sobre "Ana Souza" com 5 opções
    E na rodada seguinte a pergunta não é mandada de novo

  Esquema do Cenário: Resposta do corretor atualiza o estágio
    Dado a pergunta de estágio de "Ana Souza" foi enviada a "Marina Alves"
    Quando "Marina Alves" toca em "<opção>"
    Então "Ana Souza" fica no estágio "<estágio>"
    E a primeira resposta de "Ana Souza" fica registrada

    Exemplos:
      | opção          | estágio         |
      | Visita marcada | visit_scheduled |
      | Visita feita   | visit_done      |
      | Proposta       | proposal        |
      | Sem resposta   | qualified       |

  Cenário: Perdido pede o motivo antes de salvar
    Dado a pergunta de estágio de "Ana Souza" foi enviada a "Marina Alves"
    Quando "Marina Alves" toca em "Perdido"
    Então "Marina Alves" recebe a pergunta "Qual o motivo da perda de Ana Souza?"
    E "Ana Souza" continua no estágio "qualified"
    Quando "Marina Alves" digita "Comprou com outra imobiliária"
    Então "Ana Souza" fica perdida com o motivo "Comprou com outra imobiliária"

  Cenário: Corretor não atualiza lead de outro corretor
    Dado o lead "Bruno Lima" é de outro corretor
    Quando "Marina Alves" toca num botão de estágio de "Bruno Lima"
    Então "Bruno Lima" continua no estágio "qualified"
