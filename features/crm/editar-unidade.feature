# language: pt
@crm
Funcionalidade: Editar a ficha de uma unidade
  O gestor corrige andar, área, quartos, vagas e preço de uma unidade pelo CRM, sem depender de
  importar um PDF de novo. Preço em branco tira o preço: o bot passa a dizer que o corretor
  informa (nunca inventa). O corretor só vê.

  Cenário: Gestora corrige o preço e a área
    Dado a unidade "AUR-502" com andar "5", área "68,50", quartos "2", vagas "1" e preço "765.000"
    Quando a gestora salva andar "5", área "70,00", quartos "2", vagas "1" e preço "R$ 780.000,00"
    Então a unidade é gravada com:
      | campo   | valor  |
      | andar   | 5      |
      | área    | 70     |
      | quartos | 2      |
      | vagas   | 1      |
      | preço   | 780000 |

  Cenário: Preço em branco tira o preço da unidade
    Dado a unidade "AUR-502" com andar "5", área "68,50", quartos "2", vagas "1" e preço "765.000"
    Quando a gestora salva andar "5", área "68,50", quartos "2", vagas "1" e preço ""
    Então a unidade é gravada sem preço

  Esquema do Cenário: Valor inválido é recusado com a mensagem certa
    Dado a unidade "AUR-502" com andar "5", área "68,50", quartos "2", vagas "1" e preço "765.000"
    Quando a gestora salva andar "<andar>", área "<área>", quartos "<quartos>", vagas "<vagas>" e preço "<preço>"
    Então nada é gravado e aparece "<mensagem>"

    Exemplos:
      | andar | área  | quartos | vagas | preço   | mensagem                       |
      | -1    | 68,50 | 2       | 1     | 765.000 | Andar inválido                 |
      | 5     | zero  | 2       | 1     | 765.000 | Área inválida                  |
      | 5     | 68,50 | 2,5     | 1     | 765.000 | Quartos devem ser número inteiro |
      | 5     | 68,50 | 2       | 1     | 0       | Preço inválido                 |

  Cenário: Corretora não edita a unidade
    Dado a unidade "AUR-502" com andar "5", área "68,50", quartos "2", vagas "1" e preço "765.000"
    Quando a corretora tenta salvar preço "1"
    Então nada é gravado e aparece "Só o gestor edita a unidade"
