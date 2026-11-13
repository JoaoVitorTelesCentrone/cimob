# Center One Imob: contexto do projeto

Atualizado em 12/11/2026. Status: sem clientes; fase de validação comercial.

## O que é
Oferta vertical da agência Center One para imobiliárias: **"Do anúncio à visita."**
Quatro peças conectadas, implantadas e operadas pela Center One:
1. **Anúncios e vídeos:** Meta Ads (clique para WhatsApp) e vídeos feitos a partir das fotos reais dos imóveis (Higgsfield), aprovados pelo cliente.
2. **Site do corretor (white label) com espelho de vendas 3D:** unidades clicáveis, disponível/reservado/vendido, dia/noite, WhatsApp com o código da unidade.
3. **Bot no WhatsApp (Cloud API oficial + n8n + LLM via OpenRouter):** 4 perguntas (objetivo, faixa, prazo, visita), handoff para o corretor com resumo. Nunca inventa preço, área ou disponibilidade.
4. **CRM de leads:** funil, alerta de lead sem resposta há mais de 2 h, rodízio entre corretores, painel por origem e por corretor, status das unidades sincronizado com o site.

## Cliente ideal (hipótese)
- Imobiliária pequena ou média (3 a 15 corretores), venda residencial, numa região definida.
- Melhor encaixe do pacote completo: imobiliárias e corretores que revendem lançamentos (usam o espelho 3D).
- Imóvel usado: sem espelho 3D (no futuro, tour gerado a partir de vídeo).

## Preços atuais (Plano Fundador, sem cases)
- **Mensalidade:** R$ 1.390/mês, 30% abaixo do mercado. Inclui campanhas, até 4 vídeos ou peças por mês, bot, CRM, treinamento e relatório mensal.
- **Implantação:** R$ 1.500, uma vez.
- **Espelho 3D (opcional):** R$ 2.100 por empreendimento + R$ 290/mês. Exige o modelo 3D do prédio.
- **Corretor parceiro no mesmo espelho:** R$ 197/mês. Hipótese ainda não testada.
- Verba de anúncio paga direto pelo cliente. Fidelidade mínima de 3 meses. Preço fundador em troca de autorização para usar o case.
- **Custo estimado por cliente:** cerca de R$ 1.200/mês. Não cobrar menos que isso; se pedirem desconto, reduza o escopo em vez do preço.
- **Depois de 3 cases:** R$ 2.497 de implantação + R$ 1.997/mês.

## Referências de mercado (pesquisa de 12/11/2026)
- Agência de tráfego, cliente pequeno: R$ 2.000–4.000/mês. Freelancer júnior: R$ 500–1.200/mês.
- Pacote de agência (tráfego + redes): a partir de R$ 1.590/mês.
- CRM Imobzi: a partir de R$ 129/mês. Bot de WhatsApp SaaS: cerca de US$ 205/mês para 5 corretores.
- Tour virtual 360°: referência de R$ 3 mil.
- Concorrentes diretos: AlicIA Agência, Numuu, Central Ledo, Kenlo/LYA, Imobzi, Viniun. Espelho 3D: Maverick Frame, Vestate.

## Plano comercial
- 20 imobiliárias abordadas → 8 conversas → 3 demonstrações → 1 cliente pagante.
- Antes de abordar, testar o atendimento delas como interessado e usar o tempo de resposta como gancho.
- Abordagem individual, sem disparo em massa. Na call, mostrar a demo integrada com o empreendimento que o cliente vende.

## Stack
Next.js + TypeScript + Supabase + Drizzle; n8n no Hetzner; WhatsApp Cloud API; OpenRouter (DeepSeek); React Three Fiber para o 3D (modelo .glb com cada unidade nomeada pelo número dela).
Próximos passos técnicos: carregar um .glb real, ligar a tabela de unidades ao Supabase, criar o painel do corretor e um login por imobiliária.

## Regras
- Nunca publicar número inventado como resultado (as pranchas de identidade são ilustrativas).
- Não prometer venda; medir leads, qualificados, tempo de resposta, visitas e propostas.
- Conta de anúncios, página e número de WhatsApp ficam no nome do cliente.
- Seguir a LGPD, as regras de anúncio de moradia da Meta e a exigência de CRECI nas peças.

## Marca
Identidade Center One v1.1. Cores: forest #0B1F17, green #155F4B, lime #C8FF5A, cream #F6F4E9, graphite #3A3A3A. Fontes: Bricolage Grotesque nos títulos e Inter no texto. Grafismos: arcos concêntricos em lime e forma de D. Falta o logo em SVG.

## Links (artefatos)
- Playbook de implementação: https://claude.ai/artifact/EGQMFnnNiQuurzah7fd6Kc
- Demo integrada (site 3D + bot + CRM): https://claude.ai/artifact/RW79TZXy71VYcCjbsQrhQE
- Design system Center One: https://claude.ai/artifact/EBXSPXnSSuctq2TNGHdGmQ
- Apresentação para o cliente: https://claude.ai/artifact/Q8fsJg1vtazzbmBSzPV817
- Espelho 3D (versão antiga, separada): https://claude.ai/artifact/BPKZJjbQRnEx6ZAY3ZYq67
- CRM (versão antiga, separada): https://claude.ai/artifact/UKfnXgtrCh46tmmrvuBnyf
