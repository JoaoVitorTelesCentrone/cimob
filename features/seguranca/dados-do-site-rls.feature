# language: pt
@seguranca
Funcionalidade: Dados do site e do estoque no banco
  O site público lê só o que está publicado. O estoque só é editado pelo gestor da própria imobiliária.

  Contexto:
    Dado a imobiliária "Horizonte" com o empreendimento "Aurora" publicado e a unidade "AUR-502"
    E a imobiliária "Alfa" com o empreendimento "Rascunho" não publicado e a unidade "RAS-101"
    E "Marina" é gestora da "Horizonte"
    E "Rafael" é corretor da "Horizonte"
    E "Paulo" é gestor da "Alfa"

  Cenário: Visitante anônimo vê só o que está publicado
    Quando um visitante anônimo lista os empreendimentos e as unidades
    Então aparecem o empreendimento "Aurora" e a unidade "AUR-502"
    E não aparecem o empreendimento "Rascunho" nem a unidade "RAS-101"

  Cenário: Gestor vê os rascunhos da própria imobiliária
    Quando "Paulo" lista os empreendimentos e as unidades
    Então aparecem o empreendimento "Rascunho" e a unidade "RAS-101"

  Cenário: Corretor de outra imobiliária não vê o rascunho
    Quando "Rafael" lista os empreendimentos e as unidades
    Então não aparecem o empreendimento "Rascunho" nem a unidade "RAS-101"

  Cenário: Visitante anônimo não lê imóveis avulsos
    Dado o imóvel "AP-123" da "Horizonte"
    Quando um visitante anônimo lista os imóveis
    Então nenhum imóvel aparece

  Cenário: Corretor lê os imóveis da própria imobiliária
    Dado o imóvel "AP-123" da "Horizonte"
    Quando "Rafael" lista os imóveis
    Então aparece o imóvel "AP-123"

  Cenário: Gestor altera o status da unidade
    Quando "Marina" marca a unidade "AUR-502" como "reserved"
    Então a unidade "AUR-502" está "reserved"

  Cenário: Corretor não altera o status da unidade
    Quando "Rafael" marca a unidade "AUR-502" como "sold"
    Então a alteração é negada
    E a unidade "AUR-502" está "available"

  Cenário: Gestor de outra imobiliária não altera a unidade
    Quando "Paulo" marca a unidade "AUR-502" como "sold"
    Então a alteração é negada
    E a unidade "AUR-502" está "available"

  Cenário: Visitante anônimo não altera a unidade
    Quando um visitante anônimo marca a unidade "AUR-502" como "sold"
    Então a alteração é negada
    E a unidade "AUR-502" está "available"

  Cenário: Unidade não pode apontar para empreendimento de outra imobiliária
    Quando o sistema cria a unidade "ALF-101" da "Alfa" no empreendimento "Aurora"
    Então o banco recusa a unidade

  Cenário: Código de unidade é único dentro da imobiliária
    Quando o sistema cria a unidade "AUR-502" da "Horizonte" no empreendimento "Aurora"
    Então o banco recusa a unidade
