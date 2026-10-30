# Release Windows

## Antes da primeira publicação

1. Resolver os bloqueios em PRODUCTION_REVIEW.md, em especial licenças e origem do motor/runtime.
2. Não enviar o histórico local atual: ele contém jogos e dependências. Execute `npm run export:source`; revise `exports/` e inicialize um novo repositório nessa exportação. O histórico antigo é preservado localmente. Não basta excluir jogos em um commit novo.
3. Configurar o endereço real do repositório e responsáveis; não inventar autor ou URLs.
4. Conferir a exportação com scanner de segredos, além da revisão manual de assets e arquivos binários. A lista permitida reduz o escopo, mas não comprova titularidade ou ausência de segredos no conteúdo.

## Validação

- Em checkout limpo: `npm ci`, `npm run check`, `npm test`, `npm run dist:win`.
- Teste rápido dos recursos empacotados: `npx electron tests/smoke-production.cjs`. Para verificar renderização com um JAR autorizado local, passe o caminho como argumento; esse arquivo não será incluído na distribuição.
- Verificar `dist/win-unpacked/resources/app.asar`: nenhum diretório games, perfil, settings.json, screenshot ou teste local. Manter java/classes.jar e java/classesold.jar, necessários ao motor (incluindo compatibilidade).
- Testar em Windows com perfil novo: abrir biblioteca vazia, importar JAR autorizado, configurar tela, jogar vertical/horizontal, PiP, teclado, idioma, temas e exportar/importar RMS.
- Instalar em pasta sem permissão de escrita, atualizar sobre versão anterior, desinstalar preservando dados, testar segunda instância e uso sem rede.
- Assinar instalador e portátil com identidade válida; não contornar alertas do sistema. A assinatura deve ser configurada no ambiente de release, com certificados fora do Git.
- Ajustar versão em package.json e package-lock.json, registrar mudanças e gerar hashes SHA-256 dos artefatos aprovados.

## GitHub

O workflow manual gera artefatos internos para revisão, sem publicar Releases. Depois da aprovação, criar tag da versão e Release com notas, executáveis, hashes, licenças e acesso às fontes correspondentes exigidas. Não publicar jogos. Não há auto-update implementado; atualizações são manuais.

A matriz automatizada e seus limites estão em [TESTING.md](TESTING.md). Antes de publicar, todos os gates de `npm run dist:win` precisam passar.
