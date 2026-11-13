---
description: Implementa uma tarefa do roadmap com BDD + TDD (ex.: /tarefa T1.3)
---
Tarefa: $ARGUMENTS. Leia AGENTS.md, docs/08-qualidade-testes.md, docs/09-roadmap-tarefas.md e o doc da área.

Siga exatamente, parando para me mostrar o resultado nos pontos marcados com ⏸:
1. **Especificar:** escreva ou atualize o `.feature` em `features/` (Gherkin em português). ⏸ Mostre os cenários e espere meu OK.
2. **RED (BDD):** crie os step definitions e rode `pnpm test:bdd`. Mostre que falha pelo motivo certo.
3. **TDD por dentro:** para cada peça, um teste unitário RED → código mínimo GREEN → refactor. Commits `test:` → `feat:` → `refactor:`.
4. **GREEN (BDD):** rode `pnpm test:bdd` até os cenários passarem.
5. **Verificar:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`. ⏸ Mostre a saída.
6. Marque a tarefa em docs/09-roadmap-tarefas.md.
Nunca apague, pule ou enfraqueça teste. Se a regra parecer errada, pare e me pergunte.
