# language: pt
@site @e2e
Funcionalidade: Escolher unidade no espelho de vendas

  Contexto:
    Dado o site da "Horizonte Imóveis" com o empreendimento "Residencial Aurora"

  @smoke
  Cenário: Escolher unidade e chamar no WhatsApp
    Quando o visitante seleciona a unidade "502" na lista
    Então o card mostra "AUR-502", "82 m²" e "R$ 765.000"
    E o botão "Quero essa" abre o WhatsApp da imobiliária com o texto "Código: AUR-502"

  Cenário: Prédio com o modelo do arquiteto
    Dado o empreendimento tem o modelo 3D do arquiteto
    Quando o visitante abre o empreendimento
    Então o prédio 3D usa o modelo do arquiteto com as unidades da ficha ligadas

  Cenário: Status muda ao vivo
    Dado o visitante está vendo a unidade "502" como "Disponível"
    Quando o gestor marca a unidade "AUR-502" como "Reservado" no CRM
    Então o card da unidade "502" passa a mostrar "Reservado" sem recarregar a página

  Cenário: Navegador sem WebGL
    Dado um navegador sem suporte a WebGL
    Quando o visitante abre o empreendimento
    Então aparece a grade 2D de unidades com os mesmos status
    E o visitante escolhe a unidade "502" na grade 2D
    Então o card mostra "AUR-502", "82 m²" e "R$ 765.000"

  Cenário: Imagem estática antes do 3D
    Quando o visitante abre o empreendimento
    Então a imagem estática do prédio já vem no HTML, antes do 3D
    E o prédio 3D aparece depois de carregar
