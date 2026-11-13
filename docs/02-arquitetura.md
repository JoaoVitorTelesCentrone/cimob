# 02 · Arquitetura

## Monorepo
```
c1imob/
├── apps/
│   ├── web/            # Next.js 16: site público por tenant + CRM (/app)
│   │   ├── proxy.ts    # resolve o tenant por host (subdomínio ou domínio próprio)
│   │   └── app/
│   │       ├── (site)/[tenant]/...     # site do corretor + espelho 3D
│   │       ├── app/...                 # CRM autenticado
│   │       └── api/...                 # rotas internas (ex.: revalidação)
│   └── bot/            # worker: Hono (webhook) + BullMQ (filas)
│       ├── src/webhook.ts      # GET verify + POST receive → enfileira
│       ├── src/workers/inbound.ts
│       ├── src/workers/outbound.ts     # envio com rate limit
│       ├── src/workers/followup.ts     # lembretes e pergunta 1–5 ao corretor
│       └── src/flow/                   # máquina de estados da conversa
├── packages/
│   ├── db/       # Drizzle schema, migrações, políticas RLS, seeds de demo
│   ├── ai/       # cliente OpenRouter, prompts, schemas Zod de extração
│   ├── three/    # componentes R3F do espelho (BuildingViewer, UnitMesh…)
│   ├── ui/       # tokens, tema white label, componentes shadcn
│   └── config/   # tsconfig, eslint, tailwind preset
├── docs/
├── AGENTS.md
└── opencode.json
```

## Fluxo de dados
```
Meta Ads ─▶ WhatsApp ─▶ Cloud API ─▶ apps/bot /webhook ─▶ fila inbound ─▶ flow (estado)
                                                                  │
                                         OpenRouter ◀─ packages/ai ┤ (extração/FAQ)
                                                                  ▼
                                                Supabase (leads, messages, events)
                                                                  │ Realtime
                                                                  ▼
                                   apps/web /app (CRM)   ·   site 3D (status das unidades)
                                                                  │
                                                fila outbound ─▶ Cloud API ─▶ lead / corretor
```

## Resolução de tenant
1. O `proxy.ts` lê o `host`. Se for `*.c1imob.com.br`, usa o subdomínio; senão, procura o domínio próprio em `organizations.custom_domain` (com cache).
2. Reescreve a requisição para `/(site)/[tenant]` e passa o `organization_id` num header interno.
3. O CRM (`/app`) ignora o host: o tenant vem da sessão do usuário (`memberships`).

## Tema white label
`organizations.brand` (jsonb): `{ name, color, logoUrl, creci, whatsapp }`. O layout do site injeta `--brand`, `--brand-strong`, `--brand-soft` e `--on-brand` calculados a partir de `color`, garantindo contraste de 4.5:1 com `on-brand` (se não der, escurece). Os tokens de status nunca mudam.

## Segredos e config
- O token da Cloud API vale por organização: guardar criptografado (Supabase Vault) e ler só no `apps/bot`.
- `.env` por app; `.env.example` sempre atualizado.

## Observabilidade
Logs estruturados (pino) no bot, Sentry no web e no bot, e alerta (Telegram ou e-mail) quando a fila tiver falhas ou um webhook não for processado em 60 s.
