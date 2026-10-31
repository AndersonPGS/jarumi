# Estratégia de testes

Testes reduzem regressões; não demonstram ausência de todos os bugs.

## Comandos obrigatórios

- `npm run check`: sintaxe, idiomas, versões e lista de exportação.
- `npm test`: servidor com diretório temporário, biblioteca vazia, upload de fixture, metadados e proteção de arquivos privados/origens externas.
- `npm run test:e2e`: main.js, preload e renderer reais. Aciona Adicionar jogo, testa o seletor em três idiomas, cancelamento, falha do diálogo com feedback, importação, atualização do launcher, configuração inicial, backup de ida/volta, backup inválido, preferências e PiP.
- `npm run test:packaged`: o mesmo fluxo nativo contra `dist/win-unpacked/resources/app.asar`. Detecta arquivos que existem no desenvolvimento mas não foram empacotados.
- `npm run test:smoke`: verifica recursos empacotados, biblioteca vazia, configuração inicial, orientação e ausência de arquivos privados. A renderização pode ser testada passando um JAR local autorizado para `electron tests/smoke-production.cjs <caminho>`; ele não é distribuído.

`npm run dist:win` deve passar por checks, testes de servidor, integração no fonte, empacotamento e integração no pacote antes de criar Setup e Portable. Qualquer falha interrompe esse fluxo. Os workflows de CI e candidato Windows também fazem validação.

## Isolamento e limites

A integração nativa usa perfil temporário e JAR sintético, sem seus saves. Substitui apenas as respostas dos diálogos do sistema para tornar a seleção determinística. Main, preload, IPC, caminhos de disco e interface são reais. O teste não automatiza o seletor visual do Windows nem executa o instalador NSIS.

Antes de publicar, validar manualmente o Portable e o Setup em Windows limpo: abrir seletor real, importar, jogar, fechar/reabrir, atualizar preservando RMS e desinstalar preservando dados. Validar interação de teclado, telas e idiomas; manter uma coleção de MIDlets de teste com licença e fontes apropriadas. Não declarar compatibilidade universal.

## Regressão 1.0.1

No 1.0.0, `main.js` buscava `locales/pt-BR.json`, mas a lista do empacotador não incluía `locales/*.json`. O teste antigo abria os recursos web sem main/preload, então não exercitava o diálogo nativo. O novo teste falhou no pacote 1.0.0 com MODULE_NOT_FOUND e nenhuma chamada ao seletor. A correção inclui os catálogos no pacote e exibe feedback se a chamada de importação falhar.

## Regressão do volume PiP

`npm run test:pip` mede a largura clicável do slider e envia mouseDown/mouseMove/mouseUp reais pelo Electron; confere alteração de volume e controle por teclado em 160, 240 e 360 pixels. Antes da correção, o controle tinha largura zero devido ao dimensionamento flex do contêiner. Esse teste faz parte do CI e do gate de empacotamento.

## Verificação de atualizações

Os testes unitários do update-service usam respostas controladas para versões iguais/antigas/novas, componentes numéricos de múltiplos dígitos, rede indisponível, timeout, API limitada, dados inválidos, draft/prerelease, Setup/Portable e URLs não confiáveis. Não consultam a rede real no CI.

`npm run test:updates` testa startup automático, aviso apenas com versão nova, preferência desativada, tentativa manual e erro com retorno do botão ao estado ativo. `test:e2e` e `test:packaged` exercitam os novos métodos pelo preload e IPC reais com fetch do processo principal substituído por fixture, incluindo clique no botão e abertura do destino canônico. Em desenvolvimento não há consulta automática.

Não há instalação automática nem execução de binários: o download validado ou a página canônica da Release são abertos no navegador. A consulta à versão estável usa a API pública do GitHub, com timeout e uma só requisição concorrente.
