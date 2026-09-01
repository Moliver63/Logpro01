# AGENTS.md

Antes de alterar qualquer arquivo deste repositorio, leia integralmente:

- `README.md`
- `docs/FRAMEWORK_EXCELENCIA.md`
- `docs/CURRENT_STATE.md`
- `docs/ROADMAP.md`

Essa leitura e obrigatoria porque o LogPro decide viabilidade financeira com base em regras tributarias, frete e piso minimo. Mudancas pequenas podem fazer uma operacao parecer viavel quando o calculo ainda esta incompleto.

Regras de trabalho:

- Nunca invente regra tributaria, frete, piso ANTT, cidade, UF ou preco de mercado.
- Quando faltar cadastro fiscal ou dado logistico real, preserve uma pendencia explicita ate a interface.
- `viavel` e `calculoCompleto` sao INDEPENDENTES e nao devem ser reunidos.
  `viavel` responde a pergunta financeira (resultado positivo); `calculoCompleto`
  diz, separadamente, se da para confiar plenamente no numero. Junta-los ja
  quebrou o produto uma vez: como tres tributos nunca foram cadastrados e o
  piso ANTT esta com vigencia expirada, `calculoCompleto` e permanentemente
  false, e NENHUMA operacao jamais era marcada como viavel — nem a operacao de
  referencia com lucro real. A unica excecao que bloqueia viabilidade e o
  impedimento de fato: frete abaixo do piso minimo ANTT.
- Pendencia nunca pode virar boa noticia. Rota sem regra fiscal cadastrada
  exibe margem MAIOR que uma rota mapeada (tributo entra como zero), entao a
  interface precisa dizer explicitamente que o numero esta inflado por falta de
  cadastro, nao por isencao.
- Todo valor exibido ao usuario precisa manter sua origem: `informado_usuario`, `calculado_sistema`, `api_externa` ou `estimado`.
- Antes de entregar qualquer alteracao, rode `npm test` no backend alem de
  typecheck e build. Dois bugs ja escaparam de typecheck+build e so apareceram
  em teste ou em runtime: um arredondamento que vazava `7000.000000000001` para
  a memoria de calculo, e uma transacao `async` que derrubava TODA operacao
  valida com erro 500.
- Teste novo acompanha correcao de bug. Os testes de motor exercitam o
  `DealEngine` direto e nao passam por `executarCalculo` — foi essa fronteira
  que deixou o bug da transacao escapar.
- Todas as rotas da aplicacao exigem sessao (`exigirLogin`). Rota nova entra
  protegida; so `/api/health` e `/api/auth` sao publicas.

