---
description: Escreve uma especificação Gherkin (pt-BR) a partir de uma descrição de comportamento
---
Se o comportamento ainda não foi discutido, rode antes `/grill-me` e use as respostas.
Escreva um arquivo `.feature` em `features/` para: $ARGUMENTS
- `# language: pt`, com tags de área (@bot, @crm, @site, @seguranca) e @e2e se precisar de navegador.
- Um comportamento por cenário, em linguagem de negócio, usando Esquema do Cenário + Exemplos para variações.
- Reaproveite steps existentes (procure em `**/steps/`) antes de criar novos.
- Inclua pelo menos 2 casos de borda.
Mostre o arquivo e liste os steps novos que vão precisar de implementação. Não implemente código.
