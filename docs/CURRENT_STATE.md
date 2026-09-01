# Estado Atual

O LogPro01 e um MVP funcional de viabilidade de operacoes de graos com backend Node/Express/TypeScript, Postgres via Drizzle e frontend React/Vite/Tailwind. O fluxo principal calcula receita, custo da mercadoria, frete, tributos, custos adicionais, margem, resultado por saca e checagem de piso minimo ANTT quando ha dados suficientes.

## O que esta garantido

- O `tax_engine` nao inventa tributos. Sem regra ativa e vigente para o cenario, ele retorna pendencia.
- O `freight_engine` manual nao estima frete real. Frete ausente ou zerado bloqueia calculo valido na validacao da API.
- O `deal_engine` so marca uma operacao como viavel quando o resultado e positivo e o calculo esta completo.
- Pendencias tributarias, logisticas e de piso ANTT aparecem em `pendenciasOperacionais`.
- A data da operacao controla a vigencia da regra tributaria quando informada.
- O salvamento de `operation` e `operation_result` acontece em transacao.
- O frontend permite salvar preferencias locais de campos fixos para novas consultas, como produto, peso por saca, frete, distancia, eixos, precos e comissoes. Esses valores continuam sendo dados informados pelo usuario.
- Resultados calculados podem ser exportados em PDF via impressao do navegador, planilha `.xls` compativel com Excel e CSV separado por ponto e virgula.

## Limites conhecidos

- As regras tributarias seed cobrem apenas os cenarios de referencia documentados nas planilhas originais.
- As regras seed ainda precisam de validacao por especialista tributario antes de uso comercial.
- O provider de frete atual e manual. Ainda nao ha cotacao real via transportadora ou Sapiens/SPIA conectada ao motor.
- A rota `/api/freight-reference/antt` calcula referencia de piso minimo quando ha dados e coeficiente vigente; sem isso, retorna pendencia.
- Postgres ja e a base atual, mas ainda falta consolidar migrations versionadas.
- O historico persistido ainda guarda apenas resumo da operacao e do resultado, nao a memoria completa imutavel.
- As preferencias de campos fixos ficam no `localStorage` do navegador. Elas ainda nao sao sincronizadas entre dispositivos nem compartilhadas por equipe.
- O perfil tributario salvo na engrenagem e apenas uma anotacao operacional. Ele nao altera calculo fiscal; regras tributarias continuam dependendo de cadastro versionado no `tax_engine`.
- A exportacao atual roda no frontend. Ainda nao existe endpoint backend para gerar arquivo assinado, armazenar anexos ou reenviar cotacao por e-mail/WhatsApp.

## Comandos de validacao

Backend:

```bash
cd backend
npm install
npm run test
npm run typecheck
npm run build
```

Frontend:

```bash
cd frontend
npm install
npx tsc -b --noEmit
npx vite build
```

## Garantias do motor

- Nao existe default silencioso para tributo ausente.
- Nao existe frete zero aceito como frete real.
- Frete informado abaixo do piso minimo ANTT impede viabilidade quando a checagem e aplicavel.
- Falta de validacao do piso minimo ANTT torna o calculo incompleto.
- Despesa adicional sem `valorTotal` ou `valorPorSaca` e rejeitada na entrada.
