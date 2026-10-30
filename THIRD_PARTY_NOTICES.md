# Componentes de terceiros — inventário inicial

Este documento não substitui os textos das licenças nem representa liberação para redistribuição.

| Componente | Evidência local | Pendência |
| --- | --- | --- |
| Electron, Chromium, Node.js | dependência Electron; licenças no runtime distribuído | Preservar LICENSE e LICENSES.chromium.html do pacote |
| JSZip | package-lock.json e node_modules/jszip | Preservar licenças e dependências transitivas |
| Motor em bld/ | Cabeçalhos Mozilla/Apache-2.0, Oracle e outros em j2me.js | Identificar upstream, versão, fontes correspondentes, patches e todas as licenças |
| java/classes.jar e java/classesold.jar | Runtime de classes necessário ao motor | Hashes idênticos ao upstream Rosabis/J2meJS confirmado; fontes correspondentes e combinação de licenças ainda pendentes |
| TinySynth, BenzAMRRecorder, encoding, promise, shims e estilos legados | Arquivos em libs/, polyfill/ e style/ | Recuperar licenças completas e atribuições de cada biblioteca e seus componentes |
| Emojis legados | style/emoji/LICENSE | Preservar aviso; verificar origem dos assets |
| VT323, Press Start 2P, Silkscreen e Space Mono | assets/fonts, OFL por família e PROVENANCE.json com commit/hashes | Licenças OFL incluídas; carregamento local |

Não remover cabeçalhos existentes. `java/classes2.jar` é uma cópia não utilizada e fica fora do Git e do pacote. Não é apagada da máquina.

Textos GPL-2.0 e Apache-2.0 foram preservados em LICENSES/ para os avisos encontrados no motor. Sua inclusão não atribui uma licença única ao projeto nem resolve a identificação dos componentes e das fontes correspondentes.

A revisão documentada em [docs/LICENSING_REVIEW.md](docs/LICENSING_REVIEW.md) registra a origem verificada dos runtimes e corrige a hipótese de que classesold.jar não conteria classes org/recompile. Não houve relicenciamento para GPL-3.0.
