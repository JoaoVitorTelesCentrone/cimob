# Center One

Center One é uma agência de crescimento digital: **estratégia, tecnologia e execução** para impulsionar negócios. Este sistema cobre duas camadas:

1. **A marca Center One:** site da agência, propostas, posts, materiais de venda e o padrão visual das demos.
2. **Os produtos white label (Imob):** site do corretor com espelho de vendas 3D, bot de WhatsApp e CRM de leads. Eles usam a estrutura deste sistema, mas com a marca de cada imobiliária no token `brand`.

As pranchas de identidade (v1 e v1.1) estão no grupo de assets **Identidade**. A v1.1 é a referência atual.

## Conceito e voz

- Tagline: **Estratégia. Tecnologia. Crescimento.** Posição: *parceira de crescimento digital*.
- Pilares: foco em resultado, estrutura e tecnologia, execução de ponta, parceria de longo prazo.
- Português do Brasil, direto, confiante, sem jargão vazio. Frases curtas; títulos em caixa alta com até três linhas, e uma palavra ou frase final em destaque lime ("EXECUÇÃO.", "PARA O SEU CRESCIMENTO.").
- Overline acima de títulos, em caixa alta espaçada: "PARCEIRA DE CRESCIMENTO DIGITAL", "NOSSO MÉTODO".
- CTAs com verbo e seta ↗: "Fale com a gente", "Solicitar diagnóstico", "Ver projetos".
- **Números só reais.** As pranchas mostram "+50 projetos", "+342 leads" e "+3x conversão" como ilustração. No site e nas propostas, só publique números que você pode comprovar; até lá, use processo (Diagnóstico → Estratégia → Execução) e cases com autorização.

## Cor

| Cor | Token | Papel |
| --- | --- | --- |
| Forest `#0B1F17` | `forest` | Fundo principal da marca; texto sobre lime e cream |
| Green `#155F4B` | `green` | Cards e blocos de destaque; ação primária no tema claro |
| Lime `#C8FF5A` | `lime` | CTA, palavra ONE, ícones e arcos sobre escuro. Texto sobre lime é sempre `on-lime` (forest) |
| Cream `#F6F4E9` | `cream` | Fundo claro, palavra CENTER, texto sobre forest |
| Graphite `#3A3A3A` | `graphite` | Neutro de apoio em peças físicas e mockups |

A marca é **escura primeiro**: hero, header e rodapé em `forest`, com seções claras em `cream` para respiro. Lime é acento e não fundo de página: no máximo um bloco lime grande por tela (o CTA final ou um card de serviço).

Os tokens semânticos (`brand`, `surface`, `ink`...) mudam entre os temas **Claro** (cream) e **Escuro** (forest). No escuro, `brand` vira lime com texto forest, como o botão "Fale com a gente".

### Status (produtos)

`available*` (disponível, ganho), `reserved*` (reservado, visita), `sold*` (vendido, perdido) e `stage-*` (etapas do lead) são informação e nunca mudam com a marca do cliente. Selo = fundo `*-soft` + texto `*-ink`. Todos os pares passam 4.5:1 nos dois temas.

## Tipografia

- **Bricolage Grotesque** (`display`) para títulos, destaques e números grandes: peso 800, caixa alta nos títulos de seção, entrelinha justa (1.0 a 1.1). A v1.1 cita Monument como alternativa.
- **Inter** (`sans`) para texto, interface e leitura: 400 no corpo e 600 a 700 em rótulos e botões.
- A v1 usava Syne e Sora; foram substituídas.
- A wordmark CENTER ONE é desenho de logo, não texto digitado com a fonte: use o arquivo vetorial do logo (ver Logo).

## Elementos gráficos

- **Arcos concêntricos** em linha lime (1.5 a 2 px), saindo de um canto: o grafismo principal em fundos escuros, cards e peças.
- **Forma D / quarto de círculo:** blocos com um lado totalmente arredondado, em lime, cream ou green.
- **Estrela de 4 pontas** em linha fina, como acento pontual.
- **Monograma CO** em ícone de app: fundo forest, "C" cream e "O" lime, com `radius-xl`.
- Use um grafismo por bloco, nunca todos juntos.

## Ícones

Ícones de linha com traço de 1.5 a 2 px e cantos arredondados, monocromáticos: lime sobre escuro e forest ou green sobre claro. Temas recorrentes: alvo (resultado), camadas (tecnologia), raio (execução), seta ↗ (crescimento), monitor, gráfico de barras, calendário, pessoas. A biblioteca em SVG ainda não está no sistema.

## Espaço e forma

Grade de 4 px (`space-1` a `space-8`). Botões e selos em `radius-pill`; cards em `radius-lg`; seções e ícone do app em `radius-xl`. Pouca sombra: a profundidade vem do contraste forest, green e cream. Sombras só em elementos flutuantes (`shadow-overlay`).

## Logo

A wordmark tem CENTER em cream e ONE em lime sobre forest (ou forest e lime sobre cream), com ® no tema claro. **O arquivo vetorial ainda não está no sistema:** até chegar o SVG, não recrie o logo com fonte. Nas interfaces, use o nome em texto ou o monograma do app a partir do PNG da prancha.

## Produtos white label (Imob)

- Só `brand`, `brand-strong`, `brand-soft` e `on-brand` trocam por imobiliária, junto com nome, logo, CRECI e WhatsApp.
- A cor do cliente precisa dar 4.5:1 com `on-brand`. Se não der, escureça `brand` e deixe a cor original só no logo.
- Nos sites dos clientes, a Center One aparece só como "Site por Center One" no rodapé.
- Componentes no bundle (`window.CenterOneImob`, React 18): `Button`, `StagePill`, `UnitStatus`, `Kpi`, `LeadCard`, `Field`. Ainda fora do bundle: drawer, modal, kanban, tabela, controles do 3D e WhatsApp simulado.

## Acessibilidade

- Texto 4.5:1 em todos os temas. Lime nunca vira texto sobre cream ou branco.
- Status sempre com palavra, não só cor.
- Foco visível: anel de 2 px em `brand`.
- Alvos de toque de pelo menos 40 px.
