# language: pt
@infra
Funcionalidade: Implantação do bot no Hetzner
  O bot roda num servidor só, com Docker Compose: o Caddy recebe o HTTPS da Meta,
  o bot processa e o Redis guarda as filas. Só o Caddy fica exposto na internet.

  Contexto:
    Dado o Compose de produção do bot

  Cenário: Só o Caddy fica exposto na internet
    Então só o serviço "caddy" publica portas, e só as portas 80 e 443
    E o "bot" e o "redis" não publicam nenhuma porta

  Cenário: As filas sobrevivem a um reinício
    Então o "redis" grava em disco com append-only
    E os dados do "redis" ficam num volume

  Cenário: O Caddy só manda tráfego para o bot saudável
    Então o "bot" tem verificação de saúde em "/health"
    E o "caddy" espera o "bot" ficar saudável para subir

  Cenário: Tudo volta sozinho depois de uma queda
    Então todos os serviços reiniciam sozinhos

  Cenário: Segredos ficam fora dos arquivos versionados
    Então o "bot" lê as variáveis de um arquivo ".env" que não vai para o git
    E o exemplo de variáveis de produção não tem nenhum valor secreto preenchido

  Cenário: O bot roda sem privilégios de administrador
    Então a imagem do bot roda com um usuário sem root
    E a imagem do bot roda o código empacotado, não o TypeScript
