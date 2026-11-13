#!/usr/bin/env bash
# Backup verificado do banco (T4.4). Uso: backup.sh once | loop
#   once: faz uma cópia, restaura num Postgres descartável e confere tabela por tabela.
#   loop: repete a cada BACKUP_EVERY_HOURS (padrão 24), começando agora.
# Falha → alerta no Telegram (se configurado) e saída 1. Sucesso → ping em BACKUP_PING_URL (se houver),
# para um monitor externo perceber quando o backup PARA de rodar.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?defina BACKUP_DATABASE_URL (conexão direta ao Postgres do Supabase)}"
DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
EVERY_HOURS="${BACKUP_EVERY_HOURS:-24}"
STUBS="${BACKUP_STUBS:-/opt/backup/stubs.sql}"
PORT=55432

log() { printf '{"time":"%s","event":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "${2:-}"; }

alert() {
  log backup_failed ",\"reason\":\"$1\""
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -fsS -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=⚠️ c1imob backup: $1" >/dev/null || true
  fi
}

# Restaura num Postgres descartável (só neste contêiner, sem rede) e compara com a origem.
verify() {
  local file="$1" work
  work="$(mktemp -d)"
  initdb -D "$work/data" -U postgres --auth=trust >/dev/null
  pg_ctl -D "$work/data" -o "-p $PORT -k $work -c listen_addresses=''" -w -l "$work/pg.log" start >/dev/null
  local q=(psql -h "$work" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA)
  local status=0

  # Contas: só id e e-mail (as tabelas do produto apontam para auth.users).
  if ! "${q[@]}" -f "$STUBS" >/dev/null 2>"$work/stubs.err"     || ! psql "$BACKUP_DATABASE_URL" -qtA -c "\copy (select id, email from auth.users) to stdout"       | "${q[@]}" -c "\copy auth.users from stdin" >/dev/null; then
    status=1; alert "verificação: não preparou o banco de teste"
  elif ! pg_restore --exit-on-error --no-owner -h "$work" -p "$PORT" -U postgres -d postgres "$file" 2>"$work/restore.err"; then
    status=1; alert "verificação: a cópia não restaurou ($(grep -m1 -E 'ERROR|error' "$work/restore.err" | tr -d '"'))"
  else
    local tables missing=0 empty=0 total=0
    tables="$(psql "$BACKUP_DATABASE_URL" -qtA -c \
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1")"
    for t in $tables; do
      local src dst
      src="$(psql "$BACKUP_DATABASE_URL" -qtA -c "select count(*) from public.\"$t\"")"
      if ! dst="$("${q[@]}" -c "select count(*) from public.\"$t\"" 2>/dev/null)"; then
        missing=$((missing + 1)); log backup_table_missing ",\"table\":\"$t\""; continue
      fi
      total=$((total + dst))
      # Origem com linhas e cópia vazia = cópia ruim. Diferença pequena é normal (gravações durante a cópia).
      if [[ "$src" -gt 0 && "$dst" -eq 0 ]]; then
        empty=$((empty + 1)); log backup_table_empty ",\"table\":\"$t\",\"source\":$src"
      fi
    done
    if [[ $missing -gt 0 || $empty -gt 0 ]]; then
      status=1; alert "verificação: $missing tabela(s) faltando e $empty vazia(s) na cópia"
    else
      log backup_verified ",\"tables\":$(wc -w <<<"$tables"),\"rows\":$total"
    fi
  fi

  pg_ctl -D "$work/data" -m fast -w stop >/dev/null || true
  rm -rf "$work"
  return $status
}

run_once() {
  local ts file auth
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  file="$DIR/c1imob-$ts.dump"
  auth="$DIR/c1imob-auth-$ts.dump"
  mkdir -p "$DIR"

  # Só os dados do produto (public + histórico de migrações). O cofre (Vault) fica de fora:
  # tokens não vão para o backup; numa restauração, a Center One cadastra de novo.
  if ! pg_dump --format=custom --no-owner --no-privileges -n public -n drizzle \
    -f "$file.part" "$BACKUP_DATABASE_URL" 2>"$DIR/.last-error"; then
    rm -f "$file.part"; alert "pg_dump falhou ($(grep -m1 -E 'error|FATAL' "$DIR/.last-error" | tr -d '"'))"; return 1
  fi
  mv "$file.part" "$file"
  # Contas (login): só os dados; numa restauração entram depois das migrações do Supabase.
  if ! pg_dump --format=custom --data-only -t auth.users -t auth.identities \
    -f "$auth.part" "$BACKUP_DATABASE_URL" 2>"$DIR/.last-error"; then
    rm -f "$auth.part"; alert "pg_dump das contas falhou ($(grep -m1 -E 'error|FATAL' "$DIR/.last-error" | tr -d '"'))"; return 1
  fi
  mv "$auth.part" "$auth"
  rm -f "$DIR/.last-error"
  log backup_written ",\"file\":\"$(basename "$file")\",\"bytes\":$(stat -c %s "$file")"

  verify "$file" || return 1

  # LGPD: cópias velhas somem (lead excluído some dos backups em até KEEP_DAYS dias).
  find "$DIR" -name 'c1imob-*.dump' -mtime +"$KEEP_DAYS" -delete
  if [[ -n "${BACKUP_PING_URL:-}" ]]; then curl -fsS -m 10 "$BACKUP_PING_URL" >/dev/null || true; fi
}

case "${1:-once}" in
  once) run_once ;;
  loop)
    while true; do
      run_once || true
      sleep $((EVERY_HOURS * 3600))
    done
    ;;
  *) echo "uso: backup.sh once|loop" >&2; exit 2 ;;
esac
