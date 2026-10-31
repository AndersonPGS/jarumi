# Revisão de origem e licenciamento

Evidência verificada em 2026-10-30; não é aprovação de distribuição pública.

## Constatações

- Upstream web identificado: [Rosabis/J2meJS](https://github.com/Rosabis/J2meJS/tree/75947c10412c7ff9927835a128b653696f402e9d), commit `75947c10412c7ff9927835a128b653696f402e9d`.
- Os arquivos locais `java/classes.jar` e `java/classesold.jar` são idênticos byte a byte aos arquivos em `java/java/` desse commit, comprovado por SHA-256. O primeiro contém 1778 entradas, o segundo 1767.
- Ambos contêm 41 entradas sob `org/recompile/mobile/` ou `org/recompile/freej2me/`. Portanto, o nome classesold não comprova ausência de FreeJ2ME nem elimina a pendência de licença.
- O README desse commit declara GNU GPL versão 2; o LICENSE contém o texto GPLv2. Isso não comprova automaticamente uma autorização GPL-2.0-or-later para todos os componentes.
- `bld/j2me.js` local contém trechos Oracle que declaram expressamente GPL versão 2 somente, além de trechos Apache-2.0/Mozilla.
- O [cabeçalho Mobile.java do FreeJ2ME](https://github.com/hex007/freej2me/blob/eb4ac87e9a0b212ba701691eb67ee4892b2b1173/src/org/recompile/mobile/Mobile.java) declara GPL versão 3 ou posterior. A presença dos nomes de pacote no bytecode local não determina sozinha a revisão exata de origem de cada classe.
- A origem histórica Mozilla está documentada em [mozilla/pluotsorbet](https://github.com/mozilla/pluotsorbet/tree/46ee3e78a4fd9c3f09026cc5cbdcf76e94b7a398). O repositório `rupor-github/freej2me` informado não estava disponível na consulta.

Os textos upstream foram preservados em `LICENSES/upstream/`; URLs, commits e hashes estão em `UPSTREAM_EVIDENCE.json`. As diferenças dos dois arquivos bld principais em relação ao upstream web estão em `upstream-patches/`. Esses patches documentam modificações; não constituem uma cadeia de build reproduzível dos runtimes Java.

## Por que não trocar simplesmente para GPL-3.0

Não se presume que um destinatário possa relicenciar código explicitamente GPL-2.0-only para GPL-3.0. O próprio texto GPLv2 diferencia a situação em que o programa permite versões posteriores. A afirmação recebida de que bastaria escolher GPL-3.0 ou GPL-2.0+ não está demonstrada pelas evidências locais.

## Para liberar distribuição pública

1. Identificar as fontes e revisões correspondentes dos dois runtimes, incluindo cada componente herdado e respectivas exceções/autorização de licença.
2. Confirmar uma combinação redistribuível de licenças ou substituir componentes com incompatibilidade não resolvida. Não remover avisos nem deduzir uma exceção Classpath para o conjunto a partir da origem histórica.
3. Disponibilizar fontes correspondentes, instruções de build, modificações e avisos exigidos; um link genérico para o upstream não demonstra isso sozinho.
4. Só então definir a licença do conjunto e atualizar o gate de publicação.

O repositório GitHub foi criado privado para trabalho interno. Isso não constitui certificação dos direitos de redistribuição.

## Auditoria adicional das fontes

`RUNTIME_SOURCE_AUDIT.json` registra a busca na árvore completa (não truncada) do commit Rosabis identificado. Esse commit contém zero arquivos `.java`. Cada runtime local possui 39 classes `.class` em `org/recompile`, correspondentes a 12 caminhos `.java` distintos não encontrados nessa árvore.

Isso não comprova infração nem ausência de fontes em outros repositórios. Demonstra que o upstream binário identificado não basta para demonstrar fontes correspondentes. Não foi atribuída autorização inexistente nem alterada a visibilidade com base apenas na declaração GPL do repositório.

### Caminhos para resolver

- Recuperar do mantenedor/upstream as fontes e revisões exatas usadas para compilar ambos os JARs, com scripts e licenças/exceções por componente; comparar os resultados com os binários distribuídos.
- Ou substituir o runtime herdado por um runtime compilado de uma árvore de fontes com origem/licenciamento compatíveis demonstrados, executando novamente os testes de compatibilidade. Não presumir que remover somente as classes org/recompile basta: outras classes podem depender delas ou derivar das mesmas fontes.
- Uma publicação inicial somente do launcher, sem motor/runtime de procedência pendente, é outro produto e exige reorganizar execução e distribuição; não representa um emulador completo pronto para download.

O próximo insumo necessário para regularizar os binários atuais é a fonte/build original dos runtimes ou uma autorização/licença compatível verificável dos respectivos titulares. Uma mensagem de outro agente não substitui essa evidência.
