# language: pt
@infra @backup
Funcionalidade: Backup verificado do banco
  Todo dia a operação copia o banco e prova que a cópia volta: restaura num Postgres
  descartável e confere tabela por tabela. Cópia que não volta, ou banco inacessível, vira
  alerta. Roda só com BACKUP_TEST=1 (precisa de Docker e do Supabase local).

  Cenário: A cópia é gravada, restaurada e conferida
    Quando o backup roda contra o banco local
    Então uma cópia é gravada
    E a cópia é restaurada e conferida com todas as tabelas do banco

  Cenário: Banco inacessível gera alerta e nenhuma cópia
    Quando o backup roda contra um banco que não responde
    Então o backup falha com o alerta "pg_dump falhou"
    E nenhuma cópia é gravada
