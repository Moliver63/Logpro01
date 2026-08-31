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
- `viavel` so pode ser `true` quando o resultado financeiro for positivo e o calculo estiver completo.
- Todo valor exibido ao usuario precisa manter sua origem: `informado_usuario`, `calculado_sistema`, `api_externa` ou `estimado`.
- Antes de entregar alteracao em motor de calculo, rode os testes do backend e typecheck/build quando o ambiente permitir.

