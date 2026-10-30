# Revisão de preparação para produção

Status: preparação técnica; publicação pública ainda bloqueada.

## Bloqueios identificados

- Histórico Git inclui jogos comerciais e node_modules. Não fazer push desse histórico. Exportar uma árvore limpa e iniciar histórico novo é o caminho previsto.
- Licenças e fontes correspondentes incompletas de bld/, java/classes.jar e bibliotecas/estilos herdados. `GPL-2.0` no package.json não resolve a procedência dos componentes. Nenhuma nova licença foi atribuída artificialmente.
- Executáveis sem certificado de assinatura e sem teste completo de instalação/atualização em Windows limpo. Builds locais são candidatos internos.

## Melhorias aplicadas

- Lista explícita de arquivos no electron-builder; instalador NSIS e portátil x64.
- Jogos e screenshots separados da instalação no aplicativo empacotado.
- Exclusões de Git e exportação limpa sem histórico antigo, jogos, saves ou dependências locais.
- Servidor limitado a recursos públicos e JARs; rejeição de origens externas e limite de upload.
- Proteção de instância única para reduzir disputa do perfil de saves.
- Checks e testes automatizados; CI e build manual sem publicação automática.
- README reescrito sem prometer jogos inclusos ou compatibilidade universal.

## Trabalho restante

- Regularizar inventário de licenças e ativos, O carregamento local das fontes e seus avisos OFL já foram regularizados; motor e runtimes continuam pendentes.
- Manter Electron atualizado e revisar avisos de dependências antes de cada release.
- Auditoria adicional de IPC, navegação e execução de JARs não confiáveis; as alterações do servidor não constituem auditoria completa do emulador.
- Testar compatibilidade com MIDlets redistribuíveis, regressões de RMS e matriz de telas em máquina limpa.
- Definir responsáveis, endereço do GitHub, canal de suporte, política de versões e assinatura.

Não foram apagados jogos/saves nem reescrito o histórico. Não foi criado commit nem efetuado push/publicação.

## Evidência de validação local

- Electron 45.1.0 e electron-builder 26.18.0 fixados no lockfile; npm audit de toda a árvore sem avisos conhecidos nesta revisão.
- Checks de sintaxe/traduções e testes HTTP passaram: biblioteca isolada, importação de fixture, resolução declarada e bloqueio de arquivos privados/origem externa.
- Recursos do app.asar abriram no Electron com perfil temporário: biblioteca vazia, configuração inicial e troca vertical/horizontal.
- Jogo local renderizou com o motor empacotado usando cópia temporária; o JAR não entrou no pacote nem na árvore de exportação.
- Conteúdo do app.asar conferido sem jogos, preferências, scripts de teste locais ou Electron de desenvolvimento.

Esses testes não substituem a matriz de instalação/atualização em Windows limpo nem a regularização das licenças.

## Preparação do GitHub

Fontes locais com OFL e proveniência, templates de issues/PR, política de segurança inicial, inventário com hashes e gate de revisão de publicação adicionados. Sem repositório remoto criado/configurado. A falta de assinatura não bloqueia, por si só, publicar código-fonte; a pendência de licenças do conteúdo herdado continua separada e aberta.

## Origem verificada após indicação do autor

Os dois runtimes foram comparados e são idênticos ao upstream Rosabis/J2meJS registrado em UPSTREAM_EVIDENCE.json. A pendência agora é resolver fontes correspondentes e condições de licença, não descobrir de qual arquivo web vieram. Ambos contêm classes org/recompile. Consulte LICENSING_REVIEW.md; não foi adotada automaticamente GPL-3.0.
