# 00 · Visão geral

## O produto
O Center One Imob leva o lead do anúncio até a visita, dentro de uma operação gerenciada pela Center One para imobiliárias pequenas e médias.

| Peça | O que faz | App |
|---|---|---|
| Site do corretor | Site white label com espelho de vendas 3D (unidades clicáveis, status ao vivo, dia/noite) e WhatsApp por unidade | `apps/web` (rotas públicas por tenant) |
| Bot de WhatsApp | Recebe o lead pela Cloud API, faz 4 perguntas, aplica o critério e passa ao corretor | `apps/bot` |
| CRM | Funil, ficha do lead, alerta de atraso, rodízio, painel, status das unidades | `apps/web` (rotas `/app`) |

## Fluxo principal
1. O anúncio na Meta ou o site abre o WhatsApp com o código da unidade (`AUR-502`).
2. O webhook do bot recebe a mensagem e grava `referral` e código.
3. O bot qualifica: objetivo, faixa, prazo, visita e nome.
4. O lead é criado no CRM e atribuído por rodízio. O corretor recebe o resumo no WhatsApp dele.
5. No dia seguinte, o bot pergunta ao corretor o estágio do lead (1 a 5) e atualiza o CRM.
6. Mudar o status de uma unidade no CRM reflete no site e no 3D em tempo real.

## Tenants e papéis
- **Organization** = imobiliária (tenant). Tem marca (cor, logo, nome, CRECI), domínio ou subdomínio e número de WhatsApp.
- Papéis: `agency_admin` (Center One), `org_admin` (gestor), `agent` (corretor, só vê os próprios leads).

## Fora do escopo do MVP
ERP de locação, contratos, portais (ZAP/VivaReal), matching de imóveis, multiunidades, app mobile nativo.

## Referências
- Demo integrada (protótipo): https://claude.ai/artifact/RW79TZXy71VYcCjbsQrhQE
- Playbook de implementação: https://claude.ai/artifact/EGQMFnnNiQuurzah7fd6Kc
- Design system: https://claude.ai/artifact/EBXSPXnSSuctq2TNGHdGmQ
