# language: pt
@site @e2e
Funcionalidade: Site público no navegador
  O visitante abre o endereço da imobiliária e vê o empreendimento com o contato pelo WhatsApp.

  Contexto:
    Dado uma imobiliária de teste com o site do "Residencial Teste" publicado e WhatsApp "5511900000000"

  @smoke
  Cenário: O site abre pelo subdomínio da imobiliária
    Quando o visitante abre o site da imobiliária
    Então vê o título "Residencial Teste"
    E vê "2 unidades disponíveis" e "a partir de R$ 520.000"
    E o botão "Quero saber mais" abre o WhatsApp "5511900000000" falando do "Residencial Teste"
    E o rodapé mostra "Site por Center One"

  Cenário: Empreendimento em rascunho não aparece no site
    Dado o empreendimento "Rascunho Secreto" não publicado da mesma imobiliária
    Quando o visitante abre o site da imobiliária
    Então não vê "Rascunho Secreto"

  Cenário: O site mostra o prédio em 3D montado a partir das unidades
    Quando o visitante abre o site da imobiliária
    Então vê o prédio em 3D com 3 unidades em 2 andares
