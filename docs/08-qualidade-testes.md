# 08 · Qualidade: BDD + TDD

## Como trabalhamos
**BDD de fora para dentro, TDD por dentro.** O comportamento é descrito em Gherkin, em português, antes de qualquer código. As partes internas nascem por TDD (red → green → refactor).

```
.feature (comportamento)  ──▶  steps falhando (RED)
        │
        └─▶ para cada peça: teste unitário RED → código mínimo GREEN → REFACTOR
        │
.feature passa (GREEN)  ──▶  refatorar com tudo verde
```

## Ferramentas
| Camada | Ferramenta | Onde |
|---|---|---|
| Especificação | Gherkin em português (`# language: pt`: Funcionalidade, Cenário, Dado, Quando, Então, E, Mas, Esquema do Cenário, Exemplos) | `features/**/*.feature` |
| Domínio, bot e integração | `@amiceli/vitest-cucumber` (Gherkin rodando no Vitest; verificar a versão ao instalar) | `apps/*/tests/steps/`, `packages/*/tests/steps/` |
| Unidade (TDD) | Vitest + `vitest --watch` | `**/*.test.ts` ao lado do código |
| E2E (navegador) | `playwright-bdd`: o Gherkin vira teste nativo do Playwright e o runner do Playwright segue no controle (fixtures, trace, paralelismo) | `e2e/steps/` |
| Banco/RLS | Vitest contra `supabase start` | `packages/db/tests/` |
| LLM | Mock por padrão; cenários com tag `@llm` usam o OpenRouter real em CI noturno | — |

Por que não Cucumber.js puro: é ruim com Vitest e ESM, e com o `playwright-bdd` o Playwright continua controlando a execução.

## Tags
- `@bot`, `@crm`, `@site`, `@seguranca`: área.
- `@e2e`: roda no Playwright; sem a tag, roda no Vitest.
- `@llm`: chama o LLM real (só em CI noturno).
- `@wip`: em construção (não falha o CI, mas não pode ir para a main).
- `@smoke`: roda em todo deploy.

## Regras de escrita do Gherkin
- Um comportamento por cenário. Linguagem do negócio, sem seletor CSS nem nome de tabela.
- `Dado` = contexto, `Quando` = uma ação, `Então` = resultado observável.
- Use `Esquema do Cenário` + `Exemplos` para variações (faixas, prazos, status).
- Steps reutilizáveis e parametrizados (`{string}`, `{int}`); nada de lógica no texto.
- Toda regra inegociável do AGENTS.md tem pelo menos um cenário em `features/`.

## Regras de TDD
- Nenhum código de produção sem um teste falhando que o exija.
- Um teste RED por vez; o mínimo para ficar GREEN; refatorar com tudo verde.
- Testes rápidos (menos de 100 ms cada), sem rede (use mock de OpenRouter, Cloud API e Redis em memória).
- Proibido apagar, pular ou enfraquecer teste para passar. Mudou a regra? Mude o `.feature` primeiro.

## Cobertura mínima
- Domínio do bot (flow, critério, extração), rodízio e `brandFromColor`: 90% de linhas.
- Todo o resto: 70%. O CI falha abaixo disso.

## Features obrigatórias (backlog de especificação)
**Bot:** fluxo completo com código; lead orgânico; unidade vendida; atendente na 1ª mensagem; pergunta fora da ficha; pergunta de preço; desconto vai para humano; vários campos numa resposta; áudio, imagem e figurinha; webhook duplicado; retorno depois de 3 h e de 25 h; prompt injection; opt-out; LLM fora do ar; corretor responde 1–5, valor inválido e silêncio; prazo acima de 6 meses vai para nutrição; nenhum corretor no rodízio.
**CRM:** lead atrasado; arrastar no funil gera evento; perdido exige motivo; corretor só vê os próprios leads; rodízio; status da unidade.
**Site:** escolher unidade e abrir o WhatsApp com o código; status ao vivo; fallback sem WebGL; marca do tenant.
**Áudio e importação:** áudio curto transcrito; áudio longo ou com falha vai para humano; PDF importado vira rascunho e só publica com aprovação.
**Segurança:** isolamento entre organizações; anônimo não lê leads; assinatura inválida do webhook é recusada.

## Definição de pronto
- Cenários da tarefa em `features/` passando, sem `@wip`.
- Testes unitários escritos antes do código (o histórico de commits mostra `test:` antes de `feat:`).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` verdes.
- Tabela nova com RLS e cenário de isolamento.
- Sem segredo em código; `.env.example` atualizado.

## Commits
`test: <cenário ou teste RED>` → `feat: <código GREEN>` → `refactor: <melhoria>`. Conventional Commits.
