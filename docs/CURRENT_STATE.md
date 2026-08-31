# Estado Atual

O LogPro01 e um MVP funcional de viabilidade de operacoes de graos com backend Node/Express/TypeScript, SQLite via Drizzle e frontend React/Vite/Tailwind. O fluxo principal calcula receita, custo da mercadoria, frete, tributos, custos adicionais, margem, resultado por saca e checagem de piso minimo ANTT quando ha dados suficientes.

## O que esta garantido

- O `tax_engine` nao inventa tributos. Sem regra ativa e vigente para o cenario, ele retorna pendencia.
- O `freight_engine` manual nao estima frete real. Frete ausente ou zerado bloqueia calculo valido na validacao da API.
- O `deal_engine` so marca uma operacao como viavel quando o resultado e positivo e o calculo esta completo.
- Pendencias tributarias, logisticas e de piso ANTT aparecem em `pendenciasOperacionais`.
- A data da operacao controla a vigencia da regra tributaria quando informada.
- O salvamento de `operation` e `operation_result` acontece em transacao.

## Limites conhecidos

- As regras tributarias seed cobrem apenas os cenarios de referencia documentados nas planilhas originais.
- As regras seed ainda precisam de validacao por especialista tributario antes de uso comercial.
- O provider de frete atual e manual. Ainda nao ha cotacao real via transportadora ou Transerve/Sapiens Agro conectada ao motor.
- SQLite local e suficiente para desenvolvimento, mas nao e a base recomendada para producao.
- O historico persistido ainda guarda apenas resumo da operacao e do resultado, nao a memoria completa imutavel.

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

