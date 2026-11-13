# Referência (não é código de produção)

Material usado para especificar o produto. Serve de inspiração: o código real é reescrito no monorepo seguindo AGENTS.md e docs/.

| Arquivo | O que é |
|---|---|
| `contexto-negocio.md` | Oferta, preços, ICP, plano comercial, regras e links |
| `prototipos/demo-integrada.html` | Shell da demo: site → WhatsApp simulado → CRM (abre `site.html` e `crm.html` em iframes) |
| `prototipos/site.html` | Espelho de vendas 3D em Three.js (prédio procedural, sol, dia/noite, unidades clicáveis). Base para `packages/three` |
| `prototipos/crm.html` | CRM protótipo (painel, kanban, leads, imóveis, equipe). Base para `apps/web/app/app` |
| `prototipos/diagnostico-digital.html` | Ferramenta comercial de diagnóstico (fora do produto) |
| `design-system/tokens.json` | Tokens Center One (fonte para `packages/ui`) |
| `design-system/README.md` | Regras da marca e do white label |

Para abrir os protótipos: sirva a pasta (`npx serve reference/prototipos`) e abra `demo-integrada.html`.

Artefatos online:
- Playbook: https://claude.ai/artifact/EGQMFnnNiQuurzah7fd6Kc
- Demo integrada: https://claude.ai/artifact/RW79TZXy71VYcCjbsQrhQE
- Design system: https://claude.ai/artifact/EBXSPXnSSuctq2TNGHdGmQ
- Apresentação para o cliente: https://claude.ai/artifact/Q8fsJg1vtazzbmBSzPV817
- Diagnóstico digital: https://claude.ai/artifact/YX5svWgLnNXk6DWpMJrvLL
