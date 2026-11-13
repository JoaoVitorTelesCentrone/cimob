# Backup verificado (T4.4): pg_dump diário + restauração de teste num Postgres descartável.
# Mesma versão principal do Postgres do Supabase (17).
FROM postgres:17-alpine

RUN apk add --no-cache bash curl \
  && mkdir -p /backups /opt/backup \
  && chown postgres:postgres /backups

COPY backup.sh stubs.sql /opt/backup/
RUN chmod +x /opt/backup/backup.sh

# initdb não roda como root.
USER postgres
ENTRYPOINT ["/opt/backup/backup.sh"]
CMD ["loop"]
