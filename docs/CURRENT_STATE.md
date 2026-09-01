# Estado Atual

O LogPro01 e um motor de viabilidade de operacoes de graos em producao, com
backend Node/Express/TypeScript, Postgres via Drizzle e frontend
React/Vite/Tailwind. O fluxo principal calcula receita, custo da mercadoria,
frete, tributos, custos adicionais, margem, resultado por saca e checagem de
piso minimo ANTT quando ha dados suficientes.

Acesso exige login com Google. Cada consulta fica vinculada ao usuario que a
fez, e o administrador controla quem tem acesso.

## O que esta garantido

- O `tax_engine` nao inventa tributos. Sem regra ativa e vigente para o
  cenario, ele retorna pendencia.
- O `freight_engine` manual nao estima frete real. Frete ausente ou zerado
  bloqueia calculo valido na validacao da API.
- `viavel` e `calculoCompleto` sao independentes. `viavel` responde a pergunta
  financeira (resultado positivo); `calculoCompleto` diz se da para confiar
  plenamente no numero. A unica excecao que bloqueia viabilidade e o
  impedimento de fato: frete abaixo do piso minimo ANTT.
- Quando ha tributo sem cadastro, a interface avisa explicitamente que o valor
  entrou como zero por falta de cadastro (nao por isencao) e que a margem
  exibida esta mais alta que a real.
- Pendencias tributarias, logisticas e de piso ANTT aparecem em
  `pendenciasOperacionais`.
- A data da operacao controla a vigencia da regra tributaria quando informada.
- O salvamento de `operation` e `operation_result` acontece em transacao.
- O assistente de chat nunca produz numero financeiro por conta propria: ele
  coleta dados e chama o mesmo motor que a rota REST usa.
- Nenhum usuario acessa consulta de outro. O filtro por dono entra no `WHERE`,
  entao pedir o id de outra pessoa devolve 404, nao os dados dela.
- Desativar um usuario encerra as sessoes dele na hora, porque a sessao vive no
  banco e nao apenas num token.

## Autenticacao e acesso

- Login com Google (OAuth 2.0), validando `id_token` (assinatura, emissor e
  audiencia) e protegendo o fluxo com `state` contra CSRF.
- A identidade e casada pelo `sub` do Google, nao pelo e-mail — o e-mail pode
  mudar, o `sub` nao.
- Login obrigatorio em todas as rotas da aplicacao. Alem de proteger dados,
  isso impede que o endpoint de chat (que consome cota paga de IA) seja usado
  por quem nao tem conta.
- Rotas de admin respondem 404 (nao 403) para quem nao e admin, para nao
  confirmar a existencia da area.
- Um admin nao consegue remover o proprio acesso — sem isso da para ficar sem
  nenhum administrador e perder o painel de vez.
- O primeiro admin vem de fora, pela variavel `ADMIN_EMAIL` aplicada no seed.

## Infraestrutura

- Postgres na Render, regiao **ohio** — a mesma do backend. A rede privada da
  Render nao cruza regioes: um banco em outra regiao falha com
  `getaddrinfo ENOTFOUND` no hostname interno.
- O seed roda a cada start e e idempotente: cria tabelas com
  `CREATE TABLE IF NOT EXISTS` e evolui as existentes com
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Antes era SQLite local. Trocado porque o disco do plano gratuito e efemero —
  o banco era recriado a cada redeploy, o que inviabiliza contas e historico.

## Limites conhecidos

- As regras tributarias seed cobrem apenas os cenarios de referencia
  documentados nas planilhas originais.
- As regras seed ainda precisam de validacao por especialista tributario antes
  de uso comercial.
- O piso minimo ANTT esta com vigencia deliberadamente expirada, para forcar
  pendencia em vez de calcular com coeficiente velho.
- O provider de frete atual e manual. A integracao Transerve existe, mas nao
  cotiza preco (a API dela solicita e rastreia, nao devolve valor por
  tonelada), entao nao implementa `FreightProvider`.
- A Transerve depende de `TRANSERVE_CLIENT_ID` e `TRANSERVE_CLIENT_SECRET`
  ainda nao fornecidos; sem eles as rotas respondem 503 explicito.
- O historico persistido guarda apenas resumo da operacao e do resultado, nao a
  memoria completa imutavel.
- O app Google esta em modo *testing*: so e-mails na lista de test users
  conseguem entrar, ate que o app seja publicado.
- O Postgres esta no plano gratuito, que expira 30 dias apos a criacao.

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
- Frete informado abaixo do piso minimo ANTT impede viabilidade quando a
  checagem e aplicavel.
- Falta de validacao do piso minimo ANTT torna o calculo incompleto (mas nao
  zera a resposta financeira).
- Despesa adicional sem `valorTotal` ou `valorPorSaca` e rejeitada na entrada.
