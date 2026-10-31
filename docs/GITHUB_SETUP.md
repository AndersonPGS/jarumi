# Criar o repositório no GitHub

Nome recomendado: **jarumi**

Descrição: **Emulador desktop de jogos Java ME (.jar), com interface pixel art, launcher, temas e modo PiP. Sem jogos inclusos.**

Topics: `j2me`, `java-me`, `emulator`, `electron`, `retro-gaming`, `pixel-art`, `windows`, `pip`.

## Visibilidade agora

Crie como **privado** enquanto a procedência/licença do motor e dos runtimes permanece pendente. A preparação técnica está disponível; a revisão ainda não aprovou distribuição pública. Privado é uma opção operacional de trabalho, não uma comprovação de direitos sobre terceiros. Não enviar jogos nem o histórico antigo em nenhuma visibilidade.

Quando a revisão de origem e licenças terminar, reavalie a abertura. Não é obrigatório assinar um executável para publicar código-fonte; assinatura e testes de instalação são requisitos separados da preparação de uma release de produção.

## Primeiro push

1. Crie `jarumi`, privado e vazio. Não adicione README, licença ou .gitignore pelo GitHub: esses arquivos já serão preparados localmente. Não selecione uma licença aleatória para resolver componentes herdados.
2. Use a árvore limpa gerada por `npm run export:source`, nunca o `.git` da pasta original. A lista de arquivos exclui jogos, perfis, builds e dependências instaladas.
3. Revise arquivos e a análise em PRODUCTION_REVIEW.md. Configure sua identidade de commit, se necessário, sem alterar configurações globais de outras pessoas.
4. Nessa árvore limpa, inicialize Git com branch `main`, faça o commit revisado e conecte o endereço exato do repositório criado. A URL ainda não foi inventada nem configurada.
5. Depois do primeiro push, habilite Actions, private vulnerability reporting (se disponível), revisão de PRs e checks obrigatórios. Restrinja permissões de Actions e segredos. Os workflows atuais usam somente leitura e não publicam Releases automaticamente.

`npm run release:check` falha deliberadamente enquanto existirem bloqueios de distribuição pública em `docs/publication-status.json`. Não altere o status sem evidência da resolução.

## Repositório criado

URL fornecida pelo mantenedor: https://github.com/AndersonPGS/jarumi.git. Visibilidade privada confirmada antes do primeiro envio. O histórico novo usa somente a árvore exportada, sem jogos ou commits anteriores do projeto. A revisão pública permanece pendente em LICENSING_REVIEW.md.

## Alteração de visibilidade solicitada pelo mantenedor

O mantenedor solicitou explicitamente tornar o repositório público mantendo o motor funcional atual e os créditos ao projeto base. Essa alteração de visibilidade não é aprovação da combinação de licenças nem remove as pendências de LICENSING_REVIEW.md. Os experimentos de substituição do runtime não foram aplicados ao aplicativo.
