# 09 · Roadmap e tarefas (para o opencode)

Execute em ordem. Cada tarefa = um PR pequeno: primeiro o `.feature`, depois os steps RED, depois TDD por dentro até ficar verde (doc 08).

## Fase 0: Fundação (semana 1)
- [ ] T0.0 Ferramentas do agente: RTK (`rtk init` no opencode), skill grill-me e checagem de `rg`/`jq` (doc 10).
- [x] T0.1 Monorepo pnpm + Turborepo, `packages/config` (tsconfig strict, eslint, prettier).
- [x] T0.1b Infra de testes: Vitest (workspace), `@amiceli/vitest-cucumber`, `playwright-bdd`, scripts `test`, `test:bdd`, `test:e2e`, `test:watch`, cobertura mínima no CI, e uma feature exemplo verde.
- [x] T0.2 `apps/web` Next.js 16 + Tailwind 4 + shadcn + `packages/ui` com os tokens (doc 07).
- [x] T0.3 Supabase local + `packages/db` (Drizzle) com organizations, memberships e as funções `is_member` e `role_in`; RLS + testes.
- [x] T0.4 Auth (magic link) e seleção de organização; layout do CRM com menu.
- [x] T0.5 `proxy.ts` com resolução de tenant (subdomínio local `*.localhost`) + teste.

## Fase 1: CRM (semana 2)
- [x] T1.1 Tabelas leads, lead_events, units, developments, properties + RLS + seed de demo (`is_demo`).
- [x] T1.2 `/app/leads` (tabela, filtros) e ficha em drawer.
- [x] T1.3 `/app/funil`: kanban dnd-kit + motivo de perda.
- [x] T1.4 `/app` painel de KPIs + alerta de atraso.
- [x] T1.5 Rodízio + `/app/equipe`.
- [x] T1.6 `/app/imoveis` com status editável + Realtime.

## Fase 2: Bot (semana 3)
- [x] T2.1 `apps/bot` Hono: verify + POST com assinatura + enfileirar (BullMQ).
- [x] T2.2 Worker inbound + idempotência + resolução da org pelo `phone_number_id`.
- [x] T2.3 Máquina de estados + mensagens interativas, guiada por `features/bot/*.feature` (LLM mockado).
- [x] T2.4 `packages/ai`: extração com Zod via OpenRouter + timeout/fallback.
- [x] T2.5 Handoff: rodízio, resumo ao corretor, `first_response_at` via pergunta 1–5.
- [x] T2.6 Worker outbound com rate limit + DLQ + alerta.
- [x] T2.7 Docker Compose (bot + redis + caddy) para o Hetzner.
- [x] T2.8 `services/transcribe` (WhisperX) + fila `transcribe` + fallback (features/bot/audio.feature). Medir a latência no CPU antes de fechar.

## Fase 3: Site + espelho 3D (semana 4)
- [x] T3.1 Site público por tenant (hero, empreendimento, contato, CRECI, "Site por Center One").
- [x] T3.2 `packages/three`: BuildingViewer + ProceduralBuilding (porte da demo).
- [x] T3.3 Carregar GLB real com `mesh_name` → unidade; hover, clique e card.
- [x] T3.4 Sol (`suncalc`), dia/noite, vistas, destaque de disponíveis, Realtime.
- [x] T3.5 Fallback 2D (grade por andar) + imagem estática antes do 3D + performance mobile. Fase 3 fechada.

## Fase 4: Piloto
- [x] T4.1 Importar gasto da Meta (Marketing API) → `ad_spend_daily`; CPL e custo por visita no painel.
- [x] T4.2 Exportação e exclusão de dados do lead (LGPD).
- [x] T4.3 Onboarding de organização (marca, número, critério) pelo `agency_admin`.
- [x] T4.4 Sentry + alertas + backup verificado.
- [ ] T4.5 `services/ingest` (Docling + Pydantic): PDF da incorporadora → rascunho de unidades → revisão no CRM → publicar (features/importacao/pdf-incorporadora.feature).
- [ ] T4.6 `packages/reports` (DuckDB): relatório mensal por cliente.

## Prompt sugerido por tarefa
> /tarefa TX.Y. Esse comando já segue o fluxo: feature → steps RED → TDD → GREEN → refactor → verificação.
