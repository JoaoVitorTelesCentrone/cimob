# 11 · O que falta (plano)

Atualizado em 14/11/2026. Fonte das tarefas: `docs/09-roadmap-tarefas.md`. Este arquivo junta o que ainda não foi feito, as pendências que surgiram durante a implementação e as decisões que dependem de você.

## Onde estamos
- **Feito:** Fase 0 inteira (exceto T0.0), Fase 1 do CRM (T1.1–T1.6), Fase 2 do bot (T2.1–T2.8) Fase 3 do site (T3.1–T3.5: site público, prédio 3D, modelo do arquiteto, card da unidade, sol, vistas, status ao vivo, fallback 2D e performance mobile) T4.1 (gasto da Meta e custo no painel), T4.2 (exportar e excluir dados do lead, LGPD), T4.3 (agência cria imobiliária, convites, marca, critério e parte técnica) e T4.4 (vigia das filas, Sentry e backup verificado), T4.5 (importação de PDF da incorporadora) e T4.6 (relatório mensal). **Roadmap concluído** (falta só a T0.0, ferramentas do agente). A T3.5 e o começo da T4.1 (cenários, steps e migrações 0017/0018) foram feitos no opencode; o Claude Code terminou a T4.1.
- **Verde hoje:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (core 14, ui 36, ai 11, three 91, reports 28, db 725 + 6 pulados do `@backup`, web 670, bot 612 + 4 pulados do cenário `@llm`; Python: transcribe 7, ingest 20) e `next build`. O `pnpm test:e2e` roda 34 cenários (CRM e site) e não pula nenhum: o último (sem WebGL) passou com a T3.5.
- **Primeiro commit em 13/11/2026** (`master`, até a T4.3). Daqui em diante, um commit por tarefa. Remoto: github.com/JoaoVitorTelesCentrone/cimob (branch `main`); o CI roda a cada push.

## 1. Tarefas do roadmap que faltam

### Fase 0
- [ ] **T0.0** Ferramentas do agente: instalar `jq` e `rtk` (não estão na máquina) e configurar a skill `grill-me`.

### Fase 1: CRM (concluída em 13/11/2026)

### Fase 2: Bot de WhatsApp

### Fase 3: Site + espelho 3D
- [x] **T3.3** GLB real com `mesh_name` → unidade; hover, clique e card.
- [x] **T3.4** Sol (`suncalc`), dia/noite, vistas, destaque de disponíveis, Realtime.
- [x] **T3.5** Fallback 2D + imagem estática antes do 3D + performance mobile. Fase 3 fechada; o último cenário E2E de `espelho-3d.feature` (sem WebGL) deixou de ser pulado.

### Fase 4: Piloto
- [x] **T4.1** Gasto da Meta → `ad_spend_daily`; CPL e custo por visita no painel.
- [x] **T4.2** Exportação e exclusão de dados do lead (LGPD).
- [x] **T4.3** Onboarding de organização (agência, convites, marca, critério, parte técnica).
- [x] **T4.4** Sentry + alertas + backup verificado.
- [x] **T4.5** `services/ingest`: PDF da incorporadora → rascunho de unidades → revisão → publicar.
- [x] **T4.6** `packages/reports` (DuckDB): relatório mensal por cliente.

## 2. Pendências que surgiram durante a implementação

### 2.1 Funcionais
- **Realtime (T1.6):** painel, funil, lista de leads e imóveis recarregam sozinhos (até 400 ms depois da última mudança). Tabelas publicadas: `leads`, `lead_events`, `units`, `properties` (migração 0009). O cliente do navegador precisa entregar o token ao Realtime antes de assinar (`connectRealtime`); sem isso a assinatura vira anônima e o RLS recusa. O site público assina `units` como anônimo, filtrando por `development_id` (T3.4).
- **Imóveis:** o gestor muda o status pelo seletor; não há histórico de mudança de status de unidade (não existe tabela de eventos de estoque). O gestor edita a ficha da unidade pelo CRM (14/11; o banco só deixa mudar as colunas editáveis). Cadastrar unidade ou imóvel novo ainda não existe no CRM; entram pelo seed ou pela importação (T4.5).
- **Kanban em tela pequena:** corrigido em 13/11. O quadro alargava a página inteira (o menu e o título sumiam ao rolar); agora só o quadro rola (`grid-cols-[220px_minmax(0,1fr)]` no layout do CRM). Arrastar até "Perdido", fora da tela, está coberto pelo E2E com mouse real. Recolher Ganho/Perdido continua como opção de produto (decisão 4).
- **Ficha do lead:** feito em 14/11 (1ª resposta, próximo passo com data e visita; corretor dono ou gestor).
- **Lista de leads filtra em memória** (até 1.000 por organização). Se alguma imobiliária passar disso, mover filtros e ordenação para o banco.

- **Painel (T1.4), definições a confirmar:** período de 7 ou 30 dias pela data de chegada do lead; "qualificado" = marcado pelo bot ou já movido além de Novo (perdido só conta se o bot marcou); visitas e propostas = quem passou pela etapa, sem contar perdidos; a mediana da 1ª resposta fica em minutos. O alerta e os atrasados por corretor usam todos os leads, não só os do período.
- **Resposta 1–5 do corretor:** o cenário de `lead-atrasado.feature` cobre só o efeito (registrar a 1ª resposta, `lib/leads/first-response.ts`). Ler a resposta e mudar o estágio fica para o T2.5.
- **Rodízio (T1.5), decisões a confirmar:** a ordem é alfabética pelo nome exibido (`display_name`), com o ponteiro em `organizations.rotation_cursor`; o gestor também pode estar no rodízio; quem pode acionar é o sistema (bot, sem usuário no JWT) ou o gestor. Lead sem ninguém no rodízio fica sem dono (o bot, no T2.5, precisa avisar o gestor).
- **Distribuir pela ficha:** depois de distribuir, o botão some (o lead já tem dono) e a confirmação some junto; o nome do corretor aparece na ficha. Se quiser um aviso que fique na tela, dá para mostrar um toast.
- **Histórico da ficha:** em português, com de/para, quem e motivo (14/11).
- **Horário de atendimento:** decidido com você (14/11): na v1 muda só o alerta de 2 h (painel, lista, funil e ficha), que conta só o tempo dentro do horário; sem horário, tempo corrido. O gestor define em `/app/config` (dias + uma janela, hora de Brasília); `organizations.business_hours` (jsonb, migrações 0032/0033, UPDATE só nessa coluna para `authenticated`, RLS limita ao gestor). Conta em `@c1imob/core` (`businessMsBetween`). **Ainda não usa o horário:** a mediana da 1ª resposta (painel e relatório), um aviso do bot ao lead fora do horário e a pergunta de estágio de 24 h. Os cenários de banco (`onboarding.feature`) nasceram verdes, porque as migrações vieram antes do cenário.
- **Painel sem papel do usuário:** o título é o mesmo para gestor e corretor (o RLS já limita o que o corretor vê). O protótipo usa "Meu painel" para o corretor; falta expor o papel em `currentDecision`.

- **Bot (T2.1):** `apps/bot` com `GET /webhook` (verificação), `POST /webhook` (assinatura `X-Hub-Signature-256` em tempo constante, limite de 1 MB, JSON obrigatório) e `GET /health`. Enfileira o payload bruto em `inbound` com `jobId` = hash do corpo: a mesma entrega reenviada pela Meta vira um job só (por 1 dia). Redis fora do ar → 503 na hora (a Meta reenvia). Logs sem conteúdo de mensagem (LGPD). Testado com Redis real em Docker; os testes automáticos usam fila em memória.
- **Worker inbound (T2.2):** grava cada mensagem uma vez (`wa_message_id` único; em paralelo, a segunda transação espera a primeira) e chama o flow **na mesma transação**: se o flow falhar, nada fica gravado e o BullMQ tenta de novo (8 tentativas, espera crescente). Número desconhecido é descartado com aviso no log. Contato que já é lead fica ligado à conversa. Hoje o flow é só um log (`message_ready`); o T2.3 entra no `onMessage` do `apps/bot/src/server.ts`.
- **Flow (T2.3):** `apps/bot/src/flow/` (máquina de estados pura em `machine.ts`; banco em `runner.ts`). Respostas com botões (até 3) e listas (faixa e prazo). Sem LLM ainda: escolhas por id do botão ou pelo título digitado; preço por palavra-chave (só o valor da ficha); texto com "?" vira pergunta anotada para o corretor (`lead_events` `question_for_agent`); duas respostas não entendidas passam ao corretor. O T2.4 troca a detecção por palavra-chave pela extração com LLM.
- **LLM (T2.4):** `packages/ai` + integração no flow. O cenário `@llm` de `features/bot/extracao.feature` chama o OpenRouter de verdade e só roda com `OPENROUTER_API_KEY` definida (CI noturno, doc 08; o workflow noturno ainda não existe). **Nunca rodou com a chave real.** Antes do piloto: rodar com a chave e conferir o modelo padrão (`deepseek/deepseek-v4.1-flash`) no OpenRouter.
- **LLM dentro da transação:** a extração roda na transação da mensagem (até 8 s segurando a conexão). Com 8 workers são até 8 conexões presas no pior caso; se pesar, mover a extração para antes da transação.
- **FAQ pela ficha:** feito em 14/11. O bot responde preço, área, quartos e vagas só com o que está preenchido na ficha (texto fixo, sem o LLM escrever: `asksFacts`/`factText` em `texts.ts`). Campo vazio, sem unidade ou unidade vendida: diz que não tem a informação confirmada e anota a pergunta para o corretor. Outras perguntas (pet, suíte, condomínio, entrega) continuam indo para o corretor; se a ficha ganhar esses campos, entram no mesmo padrão.
- **Textos do bot são rascunho** (saudação, perguntas, aviso de privacidade, agradecimentos) em `apps/bot/src/flow/machine.ts` e `texts.ts`. Revisar com a imobiliária piloto.
- **Passagem ao corretor (T2.5):** distribui pelo rodízio, pausa o bot e manda o resumo (modelo `novo_lead`) ao WhatsApp do corretor; "Já respondi" registra a 1ª resposta; 24 h depois vai a pergunta de estágio (`atualizar_lead`, rotina a cada 5 min no bot). **Os dois modelos precisam ser cadastrados e aprovados na Meta** (textos no doc 04); sem isso a Meta recusa o envio (erro definitivo + alerta). Com o rodízio vazio, o lead fica sem dono e o evento `handoff` registra `assigned: false` (decisão 3 pendente: avisar o gestor?).
- **Site público (T3.1):** `app/(site)/[tenant]/page.tsx` + `lib/site/` (modelo puro). Destaque do 1º empreendimento publicado (entrega, unidades disponíveis, "a partir de" só com preço de unidade disponível, plantas calculadas da ficha), outros empreendimentos, contato e rodapé com CRECI e "Site por Center One". Dados de marca em `organizations.brand` (`creci`, `whatsapp`, `color`); valor fora do formato não aparece. Aviso de demonstração quando o empreendimento é `is_demo`. Conferido no navegador (desktop e celular, sem rolagem horizontal) e com 2 cenários E2E pelo subdomínio. Domínio próprio: desde 14/11 a Center One define em `/app/config` (função `set_custom_domain`, migração 0035; vazio tira; recusa formato inválido, domínio repetido e `c1imob.com.br`/`localhost`). O DNS do cliente precisa apontar para a Vercel e o domínio precisa ser adicionado no projeto da Vercel (passo manual do deploy). Lista de nutrição, domínio próprio, cancelar e reenviar convite, logo e horário de atendimento já foram feitos.
- **Brecha corrigida (T4.3):** pela política de UPDATE, o gestor podia mudar qualquer coluna da organização (endereço, domínio próprio, plano, `is_demo`). Agora o `authenticated` só tem UPDATE em `name`, `brand`, `qualify_timeframe` e `qualify_price_share` (migrações 0023 e 0024); o resto é da Center One.
- **Brecha corrigida (T1.5, achada na T4.2):** o Supabase concede EXECUTE ao `anon` direto, então `REVOKE ... FROM PUBLIC` não bastava. Um visitante anônimo, sem usuário no JWT, passava por "sistema" e conseguia acionar `assign_lead_by_rotation` (e ver `next_in_rotation`) com o id de um lead. A migração 0021 revoga do `anon` e muda o padrão do schema `public` para funções novas não nascerem com EXECUTE para o `anon`. Cenário novo em `rodizio.feature`. **Ao criar função nova:** conceder EXECUTE explicitamente só a quem precisa.
- **E2E e páginas ocultas:** com `cacheComponents`, o Next 16 mantém a página anterior montada e oculta. Ao contar elementos no Playwright, filtre `{ visible: true }`.
- **Áudio (T2.8):** fila `transcribe` no bot + `services/transcribe` (WhisperX no CPU, modelo `small`, int8). **Latência medida** (fala sintética pt-BR, 13/11): com 2 CPUs, 13 s de áudio em 3,9 s e 57 s em 13,1 s; com 4 CPUs, 57 s em 9,0 s. Cabe no limite de 30 s mesmo num VPS de 2 vCPUs. Mais de 4 threads ficou mais lento (padrão limitado a 4). Imagem de 4,4 GB (o torch é obrigatório no WhisperX; o triton, que não serve no CPU, é removido). Transcrição correta nas amostras ("uns 700 mil", "unidade 502"); falta medir com áudio real de WhatsApp (ruído, sotaque).
- **Áudio original não é guardado** (doc 04 previa 30 dias no Storage): só o texto fica em `messages.body`. Decisão 10.
- **WhatsApp do corretor** é cadastrado pelo gestor na tela de equipe (`memberships.whatsapp`, só dígitos com DDI, único na imobiliária). Ainda sem E2E para esse campo.
- **Nutrição:** o lead fica em `new` com `qualified = false` e o evento `nurture`. Desde 14/11 a lista de leads tem o filtro "Só em nutrição" (`?nurture=1`) e a etiqueta "Nutrição": vale para quem o bot não qualificou e continua em Novo (movido para outro estágio, deixa de ser nutrição).
- **Limitação do `@amiceli/vitest-cucumber`:** o mesmo texto de passo duas vezes no mesmo cenário (ex.: vários "E o contato responde ...") não funciona; a biblioteca liga a definição só à primeira ocorrência. Use tabela ("o contato responde, em sequência:"). E `$` e `.` no texto do passo precisam de escape (`R\$ 765\.000`).
- **Pacotes usados pelo bot importam com `.ts`** (`packages/core`): o bot roda direto no Node (type stripping, sem build), que não troca `.js` por `.ts`.
- **Envio (T2.6):** pronto e testado contra uma Graph API falsa (ordem, 429, erro definitivo, token do Vault). Falta testar com um número real da Meta: cadastrar o número em `whatsapp_accounts` (com o token no Vault) e apontar o webhook. Detalhes no doc 04.
- **Duplicidade rara no envio:** se a Meta aceitar a mensagem e o banco cair antes de marcar `sent`, a nova tentativa manda de novo. Janela pequena; aceitável para o piloto.
- **Status de entrega da Meta:** feito em 14/11. O worker de entrada lê `statuses` e grava `messages.delivered_at` e `read_at` (migração 0034; leitura antes da entrega marca as duas). `failed` depois de aceita vira `send_status = failed` com o erro da Meta e alerta da operação (sem o telefone do contato). O aviso só mexe em mensagem da imobiliária dona do número. Desde 14/11 a ficha do lead mostra a conversa com o bot (só leitura, últimas 300 mensagens) com o status de cada mensagem do bot: Na fila, Enviada, Entregue, Lida ou Não entregue. `sent` é ignorado no webhook porque o envio já marca.
- **Número sem token** fica com as respostas pendentes e gera alerta (no máximo um a cada 15 min). Quando o token for configurado, a varredura manda.
- **Pacotes do bot rodam direto no Node:** `erasableSyntaxOnly` ligado no bot e no `core`; o typecheck acusa sintaxe que o Node não roda (parameter properties, enum).
- **Implantação (T2.7):** `infra/hetzner/` (Compose com Caddy, bot e Redis; passo a passo no README). Imagem em `apps/bot/Dockerfile`: o bot é empacotado com esbuild (`dist/server.js`), porque o Node não roda TypeScript dentro de `node_modules`. Testado localmente: a pilha subiu, HTTPS do Caddy, verificação da Meta, mensagem assinada processada contra o Postgres da máquina. **Ainda não foi para um servidor real** (falta VPS, domínio e o Supabase de produção).
- **Webhook e worker no mesmo processo** (um contêiner). Separar é só subir dois serviços com a mesma imagem, se a carga pedir.
- **Migrações em produção são manuais** (`pnpm db:migrate` apontando para o Supabase de produção). O CI ainda não faz deploy.
- **Testes do bot usam o banco local** (como os de `packages/db`). A migração dos testes ficou num helper com advisory lock (`@c1imob/db/migrate`), porque o Turbo roda os pacotes em paralelo.
- **Um segredo de app para todas as imobiliárias:** o webhook usa um único `WHATSAPP_APP_SECRET` (um app da Meta da Center One para todos os números). Se cada imobiliária tiver o próprio app da Meta, a assinatura passa a depender do `phone_number_id` (decisão 6).

### 2.2 Testes e qualidade
- **E2E:** `features/crm/crm-no-navegador.feature` (7 cenários: link mágico, alerta de atraso, rodízio pela equipe e pela ficha, permissões da corretora, perder lead no funil com motivo, status e funil ao vivo entre duas pessoas). Cada cenário cria a própria imobiliária (`is_demo`) e usuários e apaga tudo no fim. As chaves vêm de `supabase status` (ou do ambiente no CI); a chave secreta fica só no processo de teste. O Playwright faz a build e sobe o app na porta 3100.
- **E2E da lista, do painel e da troca de imobiliária:** feitos em 14/11 (filtro de atrasados e de nutrição, busca sem acento, período de 7/30 dias, gestora de duas imobiliárias). Ainda sem E2E: o fluxo de e-mail do link mágico (o E2E gera o link pela API; o Mailpit continua desligado) e o WhatsApp do corretor na tela de equipe.
- **Fora da métrica de cobertura** (código de ligação com Next/Supabase): `lib/supabase/**`, `lib/org.ts`, `lib/leads/queries.ts`, as Server Actions e as rotas `/auth/callback` e `/auth/confirm`. Devem ser cobertos pelo E2E.
- **Seed de demo sem RED prévio:** os cenários de `dados-demo.feature` nasceram verdes (o código veio junto com os steps).
- **CI nunca rodou:** `.github/workflows/ci.yml` sobe o Supabase (`pnpm db:start`), o que pode ser lento no runner. Rodar no primeiro push.
- **Mailpit desligado** no Supabase local: o e-mail do link mágico não é entregue localmente. Para testar o fluxo completo por e-mail, religar o Mailpit em `db:start`.

### 2.3 Segurança e dados
- **Slugs reservados:** resolvido na T4.3 (`create_organization` recusa `app`, `login`, `auth`, `api`, `www`, `dev`, `admin` e outros). Slug criado por SQL direto não passa por essa checagem.
- **Escrita em `memberships`:** o gestor muda `in_rotation` e `whatsapp` pelo app; convidar e desativar/reativar passam pelas funções da T4.3. Mudar o papel de alguém continua só pela service role.
- **Cache do tenant por processo (60 s):** troca de domínio pode levar até 1 minuto para refletir.

### 2.4 Coisas que o onboarding (T4.3) precisa preencher
- `memberships.display_name` (nome do corretor no CRM; o app não lê `auth.users`).
- `organizations.brand.color`, logo, CRECI, WhatsApp e domínio próprio.

### 2.5 Ambiente local
- **Incidente de 13/11:** o `drizzle.config.ts` apontava por padrão para a porta 54322 (Supabase do tech-blog) e as migrações do c1imob foram aplicadas lá. Os objetos foram removidos do banco do tech-blog (tabelas vazias, sem dependências) e o padrão agora é 64322. Sempre confira `DATABASE_URL` antes de `pnpm db:migrate`.
- O Supabase local precisa do Docker Desktop aberto; `pnpm test` pode reaproveitar o cache do Turbo para `packages/db` sem tocar no banco. Para forçar, rode `pnpm --filter @c1imob/db test`.
- Supabase do c1imob nas portas **64xxx** (banco em `127.0.0.1:64322`), porque a máquina tem outras stacks Supabase nas 54xxx/55xxx.
- O banco local tem a demonstração carregada (`pnpm db:seed`; remover com `pnpm db:seed -- --remove`).
- `apps/web/.env.local` tem a chave publicável local e o login automático de desenvolvimento (ignorado pelo git).
- **CRM sem login em desenvolvimento:** `pnpm db:seed:dev` (também cria Carlos, da Center One: `carlos@demo.c1imob.local`, mesma senha da Paula; para entrar como ele, troque `DEV_AUTO_LOGIN_EMAIL` no `.env.local`) (com `SUPABASE_SERVICE_ROLE_KEY` de `npx supabase status -o env`) cria na demonstração a equipe fictícia (Paula, gestora; Marina, Rafael e Júlia, corretores; e-mails `@demo.c1imob.local`), 48 leads dos últimos 45 dias e 45 dias de gasto de anúncio, tudo com `is_demo`. Também grava `DEV_AUTO_LOGIN_EMAIL`/`DEV_AUTO_LOGIN_PASSWORD` no `.env.local`; com elas, em `next dev`, `/app` sem sessão entra direto como Paula por `/dev/entrar` (sessão real, RLS vale). Em produção a rota responde 404 e o `/login` continua. Remover: `pnpm db:seed:dev -- --remove`.
- **Redis do c1imob** na porta 6380 (contêiner `c1imob-redis`); a 6379 é de outro projeto.
- Neste ambiente, `\\` dentro de heredoc do shell vira `\`. Editar o matcher do `proxy.ts` sempre pela ferramenta de edição.

## 3. Decisões que dependem de você
1. ~~Commit~~: feito em 13/11 (commit único até a T4.3). Remoto no GitHub configurado.
2. **`/horizonte` na plataforma:** hoje `c1imob.com.br/horizonte` também mostra o site do tenant. Bloquear ou deixar?
3. ~~Gestor convida corretores pelo app?~~ Resolvido na T4.3: sim, pela tela de equipe.
4. **Colunas do kanban:** manter as 8 lado a lado ou recolher Ganho/Perdido?
5. **Decisões já tomadas sem perguntar, para confirmar:** `developments.published`, `is_demo` em todas as tabelas de negócio, `memberships.display_name`, rota `/auth/confirm`, "perdido exige motivo" e evento de estágio garantidos por constraint e trigger no banco.
6. **App da Meta:** um app da Center One para todas as imobiliárias (um segredo só, como está) ou um app por imobiliária?
7. **WhatsApp do corretor (T2.5):** decidido pelo padrão sugerido (campo em `memberships`, gestor preenche na equipe). Confirmar.
8. **Janela de 24 h (T2.5):** decidido usar modelos aprovados (`novo_lead` e `atualizar_lead`). Falta cadastrar na Meta.
9. **Quando perguntar 1–5 (T2.5):** decidido manter 24 h depois (doc 04) e registrar a 1ª resposta pelo botão "Já respondi" do resumo, para o alerta de 2 h funcionar. Confirmar.
10. **Áudio original (T2.8):** o doc 04 manda guardar 30 dias no Storage; hoje não é guardado (só a transcrição), que é o mínimo pela LGPD. Manter assim ou guardar?

## 4. Próximo passo sugerido
Roteiro do piloto, com o que precisa ser providenciado e a ordem de implantação: `docs/12-piloto.md`.

Fases 1, 2 e 3 fechadas; Roadmap concluído (T4.1 a T4.6). Próximo: preparar o piloto (subir no Hetzner/Supabase/Vercel, testes com número real da Meta, OpenRouter, áudios e PDFs reais, templates de e-mail e SMTP) e as pendências desta lista. Cada tarefa numa branch `feat/...`. Antes do piloto, continuam pendentes: testar com número real da Meta (e com uma conta de anúncios real), com a chave do OpenRouter e com áudios reais, e subir no Hetzner. Pendentes: decisões 3 (rodízio vazio) e 6 (app da Meta).
