# 01 · Pesquisa de frameworks e decisão

Pesquisa feita em 12/11/2026. Critérios, em ordem de peso:
1. Produtividade com agente de código (opencode): stack popular e bem documentada.
2. Multi-tenant seguro.
3. 3D leve no celular.
4. Confiabilidade do webhook do WhatsApp.
5. Custo baixo para operar com até 10 clientes.
6. Encaixe na stack que o JV já domina (Next.js, TS, Supabase, Drizzle, Hetzner, Vercel).

## 1. App web (site + CRM)
| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **Next.js 16 (App Router)** | Multi-tenant por subdomínio/domínio próprio via `proxy.ts` (que substitui o `middleware.ts` no Next 16); exemplo oficial da Vercel (Platforms Starter Kit); starters prontos com Supabase + RLS; stack que você já usa | Mais complexo que um SPA | **Escolhido** |
| Astro | Ótimo para site institucional e SEO | Fraco para o CRM autenticado; dois frameworks para manter | Não (no máximo, o site da Center One) |
| Remix / React Router 7 | Bom com dados | Ecossistema multi-tenant e starters menores | Não |

Referências: Vercel Platforms (multi-tenant com Next.js 16 e `proxy.ts`), MakerKit e NextBase (Next 16 + Supabase).

## 2. Banco, auth e tempo real
| Opção | Veredito |
|---|---|
| **Supabase (Postgres + Auth + RLS + Realtime + Storage)** | **Escolhido.** Isola tenant com `organization_id` + RLS; o Realtime atualiza o status das unidades no 3D e o kanban sem polling; o Storage guarda os GLB e as fotos. |
| Neon + Clerk | Bom, mas são dois fornecedores e o RLS precisa de configuração manual. Não vale agora. |

**ORM:** Drizzle para schema, migrações e jobs do servidor (com service role). Nas requisições do usuário, use o client do Supabase (`@supabase/ssr`) para o RLS valer.

## 3. 3D (espelho de vendas)
| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **React Three Fiber + drei** | Padrão para 3D declarativo em React; ecossistema do Three.js, a biblioteca 3D web mais usada (milhões de downloads por semana); integra direto com o painel React | Bundle um pouco maior que Three puro | **Escolhido** |
| Three.js puro | Controle máximo | Imperativo; mais código para integrar com React | Não |
| Babylon.js | Engine completa, com editor | Orientado a jogos; comunidade menor | Não |
| Unity WebGL | Visual top | Pesado no celular; outra linguagem | Não |

**Complementos:** pipeline glTF/GLB com Draco (gltf-transform), `suncalc` para a posição do sol, `zustand` para o estado do 3D, `@react-three/drei` (Bounds, Outlines, Html, CameraControls).

## 4. Bot de WhatsApp
| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **Worker TypeScript (Hono + BullMQ + Redis)** | Código versionado e testável (você é QA: dá para ter suíte de cenários); fila com retry e idempotência; reaproveita os tipos do monorepo; o opencode edita com facilidade | Mais código inicial | **Escolhido para produção** |
| n8n self-hosted (modo fila) | Muito rápido para prototipar; nós prontos da Cloud API | Lógica em JSON visual, difícil de testar e revisar com agente de código; precisa de Postgres + Redis + workers para ser confiável | Só para automações laterais (relatórios, alertas) |
| SaaS (Wati, Aurora, Chatsac) | Pronto | Custo por cliente, pouco controle do fluxo e dos dados | Não |
| APIs não oficiais (WAHA, QR code) | Barato | Risco de banimento do número e problemas de termos e LGPD | **Proibido** |

**Sempre usar a WhatsApp Cloud API oficial da Meta.** Separar recebimento, lógica e envio.

## 5. IA
**Vercel AI SDK** (`generateObject` com Zod) apontando para o **OpenRouter** (DeepSeek, com Kimi de reserva). O LLM só extrai campos e responde FAQ a partir da ficha; quem decide o próximo passo é a máquina de estados. Isso mantém o custo baixo e o comportamento testável.

## 6. UI
Tailwind CSS 4 + shadcn/ui com os tokens Center One. Fontes: Bricolage Grotesque e Inter (`next/font`).

## 7. Testes e qualidade (BDD + TDD)
Gherkin em português em `features/`. Os cenários de domínio, bot e integração rodam no Vitest via `@amiceli/vitest-cucumber`; os de navegador rodam via `playwright-bdd` (o Gherkin vira teste nativo do Playwright). O TDD por dentro é feito com Vitest. Cucumber.js puro foi descartado por atrito com Vitest e ESM. Detalhes no doc 08.

## 8. Deploy
| Peça | Onde | Por quê |
|---|---|---|
| `apps/web` | Vercel | Domínios por tenant, preview por PR |
| `apps/bot` + Redis | Hetzner (Docker Compose + Caddy) | Barato e sempre ligado, com fila persistente |
| Banco | Supabase Cloud (região São Paulo) | Gerenciado, com backups |
| GLB e fotos | Supabase Storage + CDN | Simples |

## Decisão final
`Next.js 16 + Supabase + Drizzle + R3F + worker Hono/BullMQ + AI SDK/OpenRouter`, em monorepo Turborepo. É a stack que você já conhece, com o 3D e o bot nas opções mais documentadas, o que importa para o opencode produzir código bom.
