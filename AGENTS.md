# Center One Imob: regras do projeto

Produto white label para imobiliárias: **"Do anúncio à visita"**. São três apps em um monorepo:
- **Site do corretor** com espelho de vendas 3D
- **Bot de WhatsApp** que qualifica o lead
- **CRM** de leads multi-imobiliária

Leia `docs/00-visao-geral.md` antes de qualquer tarefa. As decisões de stack estão em `docs/01-pesquisa-frameworks.md` e não devem ser trocadas sem pedido explícito.

## Stack (fixa)
- Monorepo: pnpm + Turborepo, TypeScript strict em tudo.
- `apps/web`: Next.js 16 (App Router, React 19). Tenant resolvido no `proxy.ts`. Tailwind CSS 4 + shadcn/ui.
- `apps/bot`: worker Node.js com Hono (webhook) + BullMQ + Redis. Roda em Docker no Hetzner.
- `packages/db`: Supabase (Postgres + Auth + Storage + Realtime) com Drizzle para schema e migrações. RLS em todas as tabelas de tenant.
- `packages/three`: React Three Fiber + drei, modelos glTF/GLB com Draco.
- `packages/ai`: Vercel AI SDK + OpenRouter (DeepSeek por padrão), saídas validadas com Zod.
- `packages/ui`: tokens do design system Center One (ver `docs/07-design-system.md`).
- Testes: **BDD + TDD** (ver `docs/08-qualidade-testes.md`). Gherkin em português em `features/`; `@amiceli/vitest-cucumber` para domínio/bot/integração; `playwright-bdd` para E2E; Vitest para unidade.

## Ferramentas do agente (ver `docs/10-ferramentas.md`)
- **RTK** instalado (`rtk init` para o opencode): toda saída de terminal passa comprimida. Para ver a saída completa de uma falha, rode `rtk proxy <comando>`.
- **ripgrep (`rg`)** para buscar no código; **jq** para ler JSON (payloads do webhook, respostas da Meta).
- **`/grill-me`** antes de `/feature`: a especificação só começa depois da entrevista.

## Regras inegociáveis
1. **Isolamento de tenant:** toda tabela de negócio tem `organization_id`, RLS ligado e teste que prova que um tenant não lê dados de outro.
2. **O bot nunca inventa:** preço, área, disponibilidade e condições vêm só da ficha do imóvel no banco. Se o campo não existir, transfere ao corretor.
3. **Webhook idempotente:** responder 200 rápido, enfileirar, deduplicar por `message_id` do WhatsApp.
4. **Segredos só no servidor:** nada de token em código de cliente nem em commit. Use `.env` + `.env.example`.
5. **LGPD:** coletar o mínimo; registrar consentimento e aviso de privacidade; permitir exportar e excluir dados do lead.
6. **Números reais:** nunca gerar dados de demonstração sem marcá-los como demo (`is_demo = true`).
7. **Cores de status fixas:** disponível, reservado e vendido não mudam com a marca do cliente; só os tokens `brand*` são white label.

## Como trabalhar (BDD de fora para dentro + TDD)
1. **Comportamento primeiro:** toda tarefa começa por um `.feature` em `features/` (Gherkin em português, `# language: pt`). Sem cenário aprovado, nada de código.
2. **Red no BDD:** escreva os step definitions e rode; o cenário deve falhar pelo motivo certo.
3. **TDD por dentro:** para cada peça necessária, faça o ciclo red → green → refactor com testes unitários no Vitest. Um teste falhando por vez, o mínimo de código para passar, depois refatorar.
4. **Green no BDD:** o cenário passa. Refatore com tudo verde.
5. Nunca escreva código de produção sem um teste falhando que o exija. Nunca apague nem enfraqueça um teste para fazer passar.
- Antes de codar, leia o doc da área (03 a 06) e a tarefa em `docs/09-roadmap-tarefas.md`.
- Mudanças pequenas e verificáveis. Rode `pnpm lint && pnpm typecheck && pnpm test` antes de dizer que terminou.
- Migrações só via Drizzle (`packages/db/migrations`), nunca editar o banco na mão.
- Nomes de código em inglês; textos de interface em português do Brasil.
- Em dúvida de produto, pergunte em vez de inventar regra de negócio.

## Comandos
- `pnpm dev`: sobe web e bot.
- `pnpm db:generate` / `pnpm db:migrate`: migrações.
- `pnpm test` (unidade + features de domínio) · `pnpm test:bdd` (só features) · `pnpm test:e2e` (playwright-bdd) · `pnpm test:watch` (TDD).
