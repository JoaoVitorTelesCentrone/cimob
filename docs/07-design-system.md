# 07 · Design system (Center One)

Fonte da verdade: https://claude.ai/artifact/EBXSPXnSSuctq2TNGHdGmQ. Implementar em `packages/ui` como variáveis CSS + preset do Tailwind 4 (`@theme`).

## Cores
| Token | Claro | Escuro | Uso |
|---|---|---|---|
| forest | #0B1F17 | #0B1F17 | Fundo da marca |
| green | #155F4B | #155F4B | Cards de destaque |
| lime | #C8FF5A | #C8FF5A | CTA, acento (texto sobre ele: forest) |
| cream | #F6F4E9 | #F6F4E9 | Fundo claro |
| brand | #155F4B | #C8FF5A | Ação (white label: muda por cliente) |
| on-brand | #FFFFFF | #0B1F17 | Texto sobre brand |
| surface | #F6F4E9 | #0B1F17 | Página |
| surface-raised | #FFFFFF | #12291F | Cards |
| surface-sunken | #ECEADC | #071510 | Colunas do kanban |
| ink / ink-muted | #0B1F17 / #4D5A52 | #F6F4E9 / #A9B5AD | Texto |
| line | #E0DDD0 | #22392F | Bordas |
| available / -soft / -ink | #16A34A / #DCFCE7 / #15803D | #4ADE80 / #12331F / #4ADE80 | Disponível, ganho |
| reserved / -soft / -ink | #F59E0B / #FEF3C7 / #B45309 | #FBBF24 / #33260B / #FBBF24 | Reservado, visita |
| sold / -soft / -ink | #8B93A1 / #ECEEF2 / #5B6472 | #6B7280 / #242A33 / #A3ABB8 | Vendido, perdido |
| stage-new / qualified / contact / proposal | #1D4ED8 / #6D28D9 / #0369A1 / #BE185D | claros correspondentes | Selos de etapa |
| danger | #DC2626 | #F87171 | Atraso, destrutivo |

## Tipografia
Bricolage Grotesque 800 (títulos, KPIs, caixa alta nas seções) + Inter 400–700 (interface). Escala: 56/32/22 (display) · 15/14/13/12/11.5 (texto).

## Forma
Espaçamento em grade de 4 px (4–32). Raios: 8 (sm), 12 (md), 16 (lg), 24 (xl), 999 (pill: botões e selos). Sombra só em overlay.

## Componentes base
Button (primary/secondary/danger, pill, ↗ no primário), StagePill, UnitStatus, Kpi, LeadCard, Field. A referência da API está no bundle do design system (`window.CenterOneImob`).

## White label
`brandFromColor(hex)` gera brand, brand-strong, brand-soft e on-brand e ajusta a luminosidade até dar 4.5:1. Teste unitário obrigatório com cores problemáticas (amarelo, verde-claro).
