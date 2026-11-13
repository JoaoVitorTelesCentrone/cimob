# language: pt
@crm
Funcionalidade: Importar tabela de preços em PDF da incorporadora

  Cenário: PDF vira rascunho para revisão
    Dado o gestor envia o PDF "tabela-aurora-nov.pdf" do empreendimento "Residencial Aurora"
    Quando a importação termina
    Então as unidades extraídas aparecem como "rascunho" com código, área, preço e status
    E nenhuma unidade nova fica visível no site

  Cenário: Publicar só depois da aprovação
    Dado um rascunho importado com 38 unidades
    Quando o gestor revisa e aprova a importação
    Então as 38 unidades passam a valer para o site e para o bot

  Cenário: Linha ilegível não é inventada
    Dado o PDF tem uma linha da unidade "AUR-704" sem preço legível
    Quando a importação termina
    Então "AUR-704" aparece com o preço em branco e marcado para revisão
    E o bot não informa preço para "AUR-704" até a correção
