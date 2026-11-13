# language: pt
@bot
Funcionalidade: Critério de qualificação de cada imobiliária
  O gestor escolhe o prazo máximo e quanto da faixa precisa cobrir do preço. O bot aplica o
  critério da imobiliária do número que recebeu a mensagem; sem mudança, vale o padrão
  (até 6 meses e 90% do preço).

  Contexto:
    Dado a imobiliária "Horizonte Imóveis" com a corretora "Marina Alves" no rodízio
    E a unidade "AUR-502" com preço de R$ 850.000 disponível

  Cenário: Critério padrão qualifica quem compra em 3 a 6 meses e cobre 90% do preço
    Quando o contato "5511987654321" pede a unidade "AUR-502" e responde:
      | resposta          |
      | Morar             |
      | R$ 600–800 mil    |
      | 3 a 6 meses       |
      | Sim               |
      | Ana Souza         |
    Então o lead de "5511987654321" fica "qualificado"

  Cenário: Critério de até 3 meses manda para nutrição quem compra em 3 a 6 meses
    Dado o critério da "Horizonte Imóveis" é prazo de até 3 meses e 90% do preço
    Quando o contato "5511987654321" pede a unidade "AUR-502" e responde:
      | resposta          |
      | Morar             |
      | R$ 800 mil–1,2 mi |
      | 3 a 6 meses       |
      | Sim               |
      | Ana Souza         |
    Então o lead de "5511987654321" fica em nutrição

  Cenário: Critério de 100% do preço manda para nutrição quem não cobre a unidade inteira
    Dado o critério da "Horizonte Imóveis" é prazo de até 6 meses e 100% do preço
    Quando o contato "5511987654321" pede a unidade "AUR-502" e responde:
      | resposta       |
      | Morar          |
      | R$ 600–800 mil |
      | Imediato       |
      | Sim            |
      | Ana Souza      |
    Então o lead de "5511987654321" fica em nutrição
