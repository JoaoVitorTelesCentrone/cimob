# 06 · CRM

## Telas (rotas `/app`)
| Rota | Conteúdo |
|---|---|
| `/app` | Painel: KPIs (leads, qualificados, mediana da 1ª resposta, visitas, propostas, ganhos), funil, por origem, por corretor, alerta de atraso |
| `/app/funil` | Kanban por `stage`, com arrastar e soltar (dnd-kit); "perdido" exige motivo |
| `/app/leads` | Tabela com busca, filtros e ordenação; atrasados primeiro |
| `/app/leads/[id]` | Ficha em drawer: qualificação, histórico (`lead_events` + mensagens), próximo passo, data da visita, botão do WhatsApp |
| `/app/imoveis` | Unidades e imóveis com status editável (só `org_admin`) |
| `/app/equipe` | Membros, rodízio e desempenho. Gestor convida (nome, e-mail, WhatsApp, papel), vê convites pendentes, desativa e reativa |
| `/app/config` | Gestor: marca (cor, CRECI, WhatsApp do site, aviso de privacidade) e critério de qualificação. Center One: número do bot e conta de anúncios, com tokens no cofre (nunca mostrados de volta). Horário de atendimento: depois |
| `/app/relatorios` | Gestor e Center One: relatório mensal (funil, custo, por origem, por corretor, estoque de hoje) com o mês anterior; imprimir/PDF e CSV (`packages/reports`, DuckDB) |
| `/app/agencia` | Só Center One (`platform_admins`): lista as imobiliárias e cria uma nova, convidando o gestor |

## Regras
- Lead atrasado: `owner_id` definido, `first_response_at` nulo e `now - assigned_at > 2h`, fora de `won` e `lost`.
- 1ª resposta: registrada quando o corretor responde pela ficha ou pela pergunta 1–5 (ou pelo inbox, na fase 2).
- Rodízio: round-robin entre os `in_rotation` ativos, com ponteiro em `organizations`.
- Todas as mudanças geram `lead_events`.

## Tempo real
O kanban e a lista assinam o Realtime em `leads` e `lead_events` da organização.

## Server Actions
Mutações via Server Actions com validação Zod e o client do Supabase do usuário (o RLS vale). Nada de service role no web, exceto em jobs administrativos isolados.
