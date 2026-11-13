# 10 · Ferramentas e bibliotecas extras

Avaliadas em 12/11/2026 para o Center One Imob. Entram só as que resolvem um problema concreto do produto ou do desenvolvimento.

## Desenvolvimento (opencode)
| Ferramenta | Para quê | Como |
|---|---|---|
| **RTK** (rtk-ai/rtk) | Comprime a saída do terminal (testes, git, lint) antes de ir para o agente. Economia de 60–90% de tokens em sessões de TDD. | `brew install rtk` ou o script oficial; depois `rtk init` para o opencode. Confira se as falhas de teste continuam visíveis; se precisar da saída bruta, use `rtk proxy`. |
| **grill-me** (mattpocock/skills) | Entrevista você até fechar o plano antes de especificar. Primeira etapa do fluxo BDD. | `npx skills add mattpocock/skills --skill grill-me`. Fluxo: `/grill-me` → `/feature` → `/tarefa`. |
| **ripgrep** | Busca rápida no código pelo agente. | Já é padrão; preferir `rg` a `grep`. |
| **jq** | Ler e filtrar JSON do webhook e da Meta durante o debug. | `cat payload.json \| jq '.entry[0].changes[0].value.messages[0]'` |

## Produto
| Biblioteca | Onde entra | Decisão |
|---|---|---|
| **WhisperX** | Transcrever áudios de leads no WhatsApp para o bot entender (doc 04). | Serviço Python separado (`services/transcribe`), com fila própria. Sem GPU no Hetzner a transcrição fica lenta: medir antes. Áudio de até 60 s; acima disso, transferir ao corretor. Se a latência no CPU ficar alta, avaliar uma API de transcrição paga. |
| **Docling + Pydantic** | Importar PDF da incorporadora (tabela de preços, memorial descritivo, book) e gerar as fichas de `units`/`developments`. É a fonte "aprovada" que o bot usa. | Script/serviço Python (`services/ingest`). O Docling converte o PDF em estrutura, o Pydantic valida, e o resultado vai para uma tela de **revisão humana** no CRM antes de publicar. Nunca publicar ficha sem aprovação. |
| **DuckDB** | Relatório mensal por cliente: cruza `ad_spend_daily` com leads e visitas a partir de export Parquet/CSV. | Job mensal (`packages/reports`) que gera o relatório sem pesar o Supabase. |

## Agência (fora do monorepo do produto)
| Ferramenta | Uso | Cuidado |
|---|---|---|
| **ScrollCraft** | Site da Center One e landing `/imobiliarias` com scroll animado. | Skill do Claude Code; no opencode, copiar a pasta da skill. Não usar no CRM. |
| **Humanizer** | Revisar propostas, posts e textos do site para tirar a cara de IA. | Nas mensagens do bot, o assistente continua se identificando como virtual. |
| **VoiceStudio** | Narração dos vídeos dos imóveis (TTS e dublagem local). | Só clonar voz com autorização escrita. Licença AGPL: uso interno, não embutir no SaaS. |
| **Trafilatura** | Extrair texto de sites para a prospecção (lista das 20) ou importar imóveis do site antigo do cliente. | Respeitar robots.txt e os termos de cada site; não coletar dado pessoal. |

## Pendentes de identificar
- **Laya** (categorização) e **Conecta BT**: avaliar quando houver link ou descrição.
