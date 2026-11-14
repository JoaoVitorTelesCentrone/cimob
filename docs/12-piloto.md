# 12 · Roteiro do piloto

Passo a passo para colocar a primeira imobiliária no ar. Os detalhes do servidor do bot estão em
`infra/hetzner/README.md`; aqui fica a ordem, o que falta providenciar e como conferir cada etapa.

## 0. O que precisa ser providenciado (fora do código)

| Item | Para quê | Quem |
| --- | --- | --- |
| Projeto Supabase de produção (região São Paulo) | Banco, Auth, Storage, Realtime | Center One |
| Projeto na Vercel ligado ao repositório (`apps/web`) | CRM e site | Center One |
| VPS no Hetzner (4 vCPU / 8 GB recomendados por causa do WhisperX e do Docling) | Bot, filas, transcrição, leitor de PDF, backup | Center One |
| Domínio `c1imob.com.br` com DNS editável | `app.`, `bot.` e subdomínios das imobiliárias | Center One |
| App da Meta (WhatsApp Cloud API) com o número da imobiliária piloto | Bot | Center One + imobiliária (decisão 6) |
| Modelos aprovados na Meta: `novo_lead` e `atualizar_lead` | Resumo e pergunta de estágio ao corretor fora da janela de 24 h | Center One |
| Chave do OpenRouter | Extração de texto livre (sem ela, o bot entende só botões e palavras-chave) | Center One |
| SMTP próprio (ex.: Resend, SES) | Link mágico e convites (o SMTP padrão do Supabase manda poucos e-mails por hora) | Center One |
| Bot do Telegram + chat (opcional) | Alertas da operação | Center One |
| Sentry (opcional): um projeto para o web e outro para o bot | Erros sem dado pessoal | Center One |
| Conta de anúncios da Meta com token `ads_read` (opcional) | CPL e custo por visita no painel | Imobiliária |

Decisões que valem antes de ir ao ar: **2** (`/horizonte` no domínio da plataforma), **6** (um app
da Meta para todas ou um por imobiliária) e **10** (guardar ou não o áudio original). Ver doc 11.

## 1. Supabase de produção

1. Criar o projeto; anotar a URL, a chave publicável e a conexão direta do Postgres.
2. Migrações: `DATABASE_URL=<conexão direta de produção> pnpm db:migrate`, de uma máquina com o
   repositório. **Confira a URL antes de rodar** (incidente de 13/11, doc 11 §2.5).
3. Auth > Email Templates: copiar `supabase/templates/magic-link.html` e `confirmation.html`
   (o link precisa ir para `/auth/confirm`).
4. Auth > SMTP: configurar o SMTP próprio. Auth > URL Configuration: `Site URL` =
   `https://app.c1imob.com.br` e as URLs de redirecionamento do domínio.
5. Primeiro admin da Center One: criar o usuário no Auth e rodar
   `insert into platform_admins (user_id) values ('<id>')`.

**Conferir:** `select count(*) from drizzle.__drizzle_migrations` bate com o número de arquivos em
`packages/db/migrations`; o RLS está ligado (`pnpm test` já prova o isolamento no banco local).

## 2. Web na Vercel

1. Projeto com raiz `apps/web` (o Turborepo builda os pacotes do workspace).
2. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `INGEST_URL`
   (`https://bot.c1imob.com.br/ingest`), `INGEST_SECRET`, e opcionalmente `SENTRY_DSN`,
   `NEXT_PUBLIC_SENTRY_DSN`. **Nunca** a chave secreta do Supabase.
3. Domínios: `app.c1imob.com.br`, `*.c1imob.com.br` (wildcard, para `horizonte.c1imob.com.br`) e,
   quando houver, o domínio próprio de cada imobiliária (também em Configurações no CRM).
   O wildcard na Vercel exige que o DNS de `c1imob.com.br` use os nameservers da Vercel.

**Conferir:** `https://app.c1imob.com.br/login` abre; o link mágico chega por e-mail e entra.

## 3. Bot no Hetzner

Seguir `infra/hetzner/README.md` (DNS de `bot.`, `.env`, `docker compose up -d --build`).

**Conferir:**
- `curl https://bot.c1imob.com.br/health` → `ok`.
- Na Meta, cadastrar o webhook `https://bot.c1imob.com.br/webhook` com o `WHATSAPP_VERIFY_TOKEN`
  e assinar o campo `messages` (a Meta só aceita se a verificação devolver o desafio).
- `docker compose run --rm backup once` termina com a cópia conferida.

Verificado localmente em 14/11: a imagem do bot builda, sobe, responde `/health` e a verificação do
webhook (403 com token errado, 200 com o certo).

## 4. Imobiliária piloto

1. Center One: criar a imobiliária em `/app/agencia` e convidar o gestor.
2. Center One, em Configurações: número do bot (Phone Number ID + token, vai para o cofre), conta de
   anúncios (opcional) e domínio próprio (opcional).
3. Gestor: marca, logo, critério, horário de atendimento; convidar os corretores com o WhatsApp de
   cada um; colocar no rodízio.
4. Imóveis: importar a tabela da incorporadora (PDF) ou cadastrar pelo seed; preencher área,
   quartos e vagas (o bot só responde o que está na ficha); publicar o empreendimento.

## 5. Teste de ponta a ponta com número real (antes do 1º anúncio)

- [ ] Mandar "Olá! Código: <unidade>" do seu celular: saudação, aviso de privacidade, perguntas.
- [ ] Perguntar o valor e a metragem: resposta igual à ficha; "aceita pet?" vira pergunta anotada.
- [ ] Mandar um áudio curto: vira texto na conversa.
- [ ] Qualificar: o lead aparece no CRM ao vivo, vai para o corretor da vez e o resumo chega no
      WhatsApp do corretor (modelo `novo_lead`).
- [ ] "Já respondi" no resumo registra a 1ª resposta; a ficha mostra a conversa com "Lida".
- [ ] Não qualificar (prazo longo): o lead aparece em "Só em nutrição".
- [ ] Exportar e excluir os dados do lead de teste (LGPD).
- [ ] Alerta no Telegram ao derrubar o Redis por 1 minuto (`docker compose stop redis`).

## 6. Se algo der errado

- **Bot:** `git checkout <commit anterior> && docker compose up -d --build`. A Meta reenvia os
  webhooks que não receberam 200; o que estava na fila fica no Redis.
- **Web:** "Promote to production" do deploy anterior na Vercel.
- **Migração:** as migrações só adicionam (sem apagar coluna); voltar o código não exige voltar o
  banco. Se precisar, restaurar o backup (README do Hetzner, "Restaurar num Supabase novo").
