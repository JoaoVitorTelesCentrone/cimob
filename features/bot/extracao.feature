# language: pt
@bot
Funcionalidade: O bot entende respostas escritas do jeito do contato
  Botões resolvem a maioria das respostas. Quando o contato escreve, o LLM ajuda a entender,
  mas só escolhe entre as opções do bot; quem responde continua sendo o bot, com textos fixos.

  Contexto:
    Dado a imobiliária "Horizonte" com a unidade "AUR-502" de R$ 765.000
    E o contato "5511987654321" começou a conversa sobre "AUR-502"

  Cenário: Vários campos numa resposta só
    Dado o LLM entende "quero morar, tenho uns 700 mil e quero comprar em até 3 meses" como objetivo "Morar", faixa "R$ 600–800 mil" e prazo "Até 3 meses"
    Quando o contato digita "quero morar, tenho uns 700 mil e quero comprar em até 3 meses"
    Então a ficha do lead fica com objetivo "Morar", faixa "R$ 600–800 mil" e prazo "Até 3 meses"
    E o bot pergunta se quer visitar

  Cenário: Faixa escrita por extenso
    Dado a conversa está na pergunta da faixa de investimento
    E o LLM entende "uns setecentos mil, mais ou menos" como faixa "R$ 600–800 mil"
    Quando o contato digita "uns setecentos mil, mais ou menos"
    Então a ficha do lead fica com a faixa "R$ 600–800 mil"
    E o bot pergunta o prazo

  Cenário: Nome no meio da frase
    Dado a conversa está na pergunta do nome
    E o LLM entende "pode me chamar de ana paula" como o nome "ana paula"
    Quando o contato digita "pode me chamar de ana paula"
    Então o lead se chama "Ana Paula"

  Cenário: Pergunta sem ponto de interrogação é anotada para o corretor
    Dado o LLM entende "tem varanda gourmet" como a pergunta "tem varanda gourmet?"
    Quando o contato digita "tem varanda gourmet"
    Então a pergunta "tem varanda gourmet?" fica registrada para o corretor
    E o bot repete a pergunta de morar ou investir

  Cenário: Pedido de pessoa escrito de outro jeito
    Dado o LLM entende "posso falar com alguém de verdade" como pedido de atendente
    Quando o contato digita "posso falar com alguém de verdade"
    Então o bot pergunta apenas o nome

  Cenário: Clique em botão não chama o LLM
    Quando o contato toca no botão "Morar"
    Então o LLM não é chamado

  Cenário: LLM fora do ar cai na pergunta fixa e registra o erro
    Dado o LLM está fora do ar
    Quando o contato digita "uns setecentos mil"
    Então o bot repete a pergunta de morar ou investir
    E fica registrado um erro do LLM no histórico do lead

  @llm
  Cenário: Com o LLM de verdade, faixa por extenso
    Dado o LLM de verdade está configurado
    E a conversa está na pergunta da faixa de investimento
    Quando o contato digita "uns setecentos mil, mais ou menos"
    Então a ficha do lead fica com a faixa "R$ 600–800 mil"
