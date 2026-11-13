# language: pt
@smoke
Funcionalidade: Código da unidade na mensagem do lead
  O anúncio abre o WhatsApp com o código da unidade (ex.: AUR-502).
  O sistema precisa reconhecer esse código no texto.

  Cenário: Reconhece o código no meio da mensagem
    Quando o lead envia "Oi, tenho interesse na AUR-502"
    Então o código da unidade é "AUR-502"

  Cenário: Aceita minúsculas e normaliza
    Quando o lead envia "quero saber da aur-502"
    Então o código da unidade é "AUR-502"

  Cenário: Mensagem sem código é lead orgânico
    Quando o lead envia "Oi, tem apartamento disponível?"
    Então nenhum código de unidade é reconhecido
