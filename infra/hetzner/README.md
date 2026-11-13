# Bot no Hetzner (Docker Compose)

Caddy (HTTPS automático) → bot (webhook + workers) → Redis (filas em disco). Só o Caddy fica exposto (portas 80 e 443). O banco é o Supabase (fora deste servidor).

## Primeira implantação

1. **Servidor:** um VPS com Docker e o plugin Compose (ex.: Ubuntu + `apt install docker.io docker-compose-v2`). Libere as portas 80 e 443 no firewall.
2. **DNS:** crie um registro A do domínio do bot (ex.: `bot.c1imob.com.br`) apontando para o IP do servidor. O Caddy só consegue o certificado depois disso.
3. **Código:** clone o repositório no servidor.
4. **Variáveis:** `cp infra/hetzner/.env.example infra/hetzner/.env` e preencha. O `.env` nunca vai para o git.
   - `DATABASE_URL`: conexão direta do Postgres do Supabase (Project Settings > Database).
   - `WHATSAPP_APP_SECRET`: App Secret do app da Meta. `WHATSAPP_VERIFY_TOKEN`: um texto que você inventa.
5. **Migrações:** rode `pnpm db:migrate` apontando `DATABASE_URL` para o Supabase de produção (de uma máquina com o repositório; o bot não migra sozinho).
6. **Subir:** `cd infra/hetzner && docker compose up -d --build`.
7. **Conferir:** `curl https://SEU_DOMINIO/health` responde `ok`.
8. **Meta:** no app da Meta (WhatsApp > Configuração), webhook `https://SEU_DOMINIO/webhook` com o `WHATSAPP_VERIFY_TOKEN`; assine o campo `messages`.
9. **Número da imobiliária:** cadastre em `whatsapp_accounts` (organização + `phone_number_id`) e guarde o token da Cloud API no Vault (`select vault.create_secret('TOKEN', 'wa-token-<org>')`, e o id em `token_secret_id`). Sem token no Vault, vale `WHATSAPP_ACCESS_TOKEN` do `.env`.
10. **Gasto da Meta (opcional):** cadastre a conta de anúncios em `meta_ads_accounts` (organização + `ad_account_id`, ex.: `act_123`) e guarde um token da Marketing API com `ads_read` no Vault (`token_secret_id`). Sem token no Vault, vale `META_ADS_ACCESS_TOKEN` do `.env`. O bot importa na subida e a cada 6 h.

## Atualizar

```
git pull
cd infra/hetzner && docker compose up -d --build
```

Durante a troca do contêiner do bot (alguns segundos) o Caddy responde 502; a Meta reenvia os webhooks que não receberam 200, então nenhuma mensagem se perde. O que já estava na fila fica no Redis (append-only, volume `redis-data`).

## Operação

- Logs: `docker compose logs -f bot` (JSON; sem texto, telefone ou token de contato).
- Alertas: defina `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env` para receber falhas de envio no Telegram.
- Fila de mortos: jobs de envio que esgotaram as tentativas ficam em `outbound-dead` no Redis; as mensagens continuam `pending` no banco e a varredura manda de novo quando o problema for resolvido.

## Monitoramento e backup

- **Vigia das filas:** o bot confere as filas a cada minuto. Mensagem esperando mais de 60 s, falha nova ou Redis fora do ar viram alerta (log e Telegram); a volta ao normal também é avisada.
- **Sentry (opcional):** defina `SENTRY_DSN` no `.env` (bot) e `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` no web (Vercel). Sem DSN, nada é enviado. Eventos saem sem telefone, e-mail, token, corpo, cookie ou query (`packages/core/src/scrub.ts`).
- **Backup verificado:** o contêiner `backup` faz `pg_dump` dos dados do produto (`public` e `drizzle`) e das contas (`auth.users`, `auth.identities`) uma vez por dia, no volume `backups`. Cada cópia é restaurada num Postgres descartável e conferida tabela por tabela; se não voltar, alerta no Telegram. Cópias com mais de `BACKUP_KEEP_DAYS` dias são apagadas.
  - Rodar na hora: `docker compose run --rm backup once`. Ver as cópias: `docker compose run --rm --entrypoint ls backup -lh /backups`.
  - Copie as cópias para fora do servidor (ex.: Hetzner Storage Box) se o servidor for o único lugar delas.
  - O cofre (Vault) não entra no backup: numa restauração, a Center One cadastra de novo os tokens da Meta em Configurações.
- **Restaurar num Supabase novo:** (1) `pnpm db:migrate` apontando para ele; (2) `pg_restore --data-only --no-owner -d "$URL" c1imob-auth-<data>.dump`; (3) `pg_restore --data-only --no-owner --disable-triggers -n public -d "$URL" c1imob-<data>.dump`; (4) cadastrar os tokens de novo.

## Leitor de PDF da incorporadora

O serviço `ingest` (Docling no CPU, sem OCR) lê a tabela de preços que o gestor envia em Imóveis > Importar. Fica atrás do Caddy em `https://SEU_DOMINIO/ingest` e só responde com `Authorization: Bearer INGEST_SECRET`. No web, defina `INGEST_URL=https://SEU_DOMINIO/ingest` e o mesmo `INGEST_SECRET`. A imagem tem ~3,9 GB (modelos de layout e tabela dentro). PDF escaneado (imagem) não é lido: peça o PDF original à incorporadora. O PDF não é guardado.

## Transcrição de áudio

O serviço `transcribe` (WhisperX no CPU) sobe junto. A imagem tem ~4,4 GB e a primeira construção baixa o modelo (alguns minutos). Medido com 2 vCPUs: áudio de 60 s em ~13 s. Ajuste `WHISPER_THREADS` para o número de vCPUs do servidor (até 4).
