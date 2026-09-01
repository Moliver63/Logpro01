# Roadmap Tecnico

Prioridade dos proximos passos tecnicos do LogPro01.

## 0. Bloqueios com prazo

Nao sao tarefas de codigo, mas vencem sozinhos e derrubam o produto.

- **Postgres no plano gratuito expira 30 dias apos a criacao**, levando os
  dados junto. Agora que o banco guarda contas de usuario e historico, migrar
  para `basic_256mb` antes do vencimento.
- **Regras tributarias seed precisam de validacao por especialista** antes de
  qualquer uso comercial. Bloqueia o produto de valer como decisao de negocio,
  nao apenas como simulacao.
- **Piso minimo ANTT com vigencia expirada de proposito.** Confirmar os
  coeficientes vigentes em `calculadorafrete.antt.gov.br` e cadastrar nova
  versao da regra.
- **App Google em modo testing.** So test users entram. Publicar quando abrir
  para outras pessoas — os escopos usados (`openid`, `email`, `profile`) sao
  nao-sensiveis e nao exigem verificacao do Google.

## 1. Memoria de calculo imutavel

- Persistir linhas de custo, tributos aplicados, regra fiscal usada, frete e
  piso ANTT junto do resultado.
- Exibir a memoria completa mesmo que regras futuras mudem.
- Guardar versao e fonte de cada regra usada.

Hoje o historico guarda so o resumo, entao uma consulta antiga reaberta depois
de uma mudanca de regra nao reproduz o que o usuario viu na epoca.

## 2. Detalhe da consulta no dashboard

- A barra lateral ja lista o historico; falta abrir uma consulta e ver o
  dashboard completo dela (depende da memoria imutavel do item 1).
- Permitir duplicar uma consulta antiga como ponto de partida para uma nova.

## 3. Idempotencia

- Adicionar chave idempotente em `POST /api/operations/calcular`.
- Evitar duplicar operacoes quando o usuario clicar duas vezes ou quando houver
  retry de rede.
- Persistir hash normalizado do input para auditoria.

## 4. Migrations versionadas

- O seed hoje cria e evolui o schema com SQL na mao, idempotente. Funciona, mas
  nao registra historico de mudancas nem permite rollback.
- Trocar por `drizzle-kit generate/migrate` quando o schema estabilizar.
- Separar configuracao de desenvolvimento, homologacao e producao.

## 5. Ampliar testes

- Cobrir as rotas de autenticacao, dashboard e admin — hoje sem teste
  automatizado; o login foi validado manualmente em producao.
- Manter fixtures com datas fixas para evitar resultado dependente do dia.
- Testar isolamento entre usuarios (um nao enxerga consulta do outro).

## 6. Provider real de frete

- Plugar um `FreightProvider` real, mantendo o contrato atual do
  `freight_engine`.
- Registrar provedor, timestamp e origem da cotacao.
- Comparar frete informado com cotacao real e piso minimo ANTT.

A Transerve nao serve para isso: a API dela solicita e rastreia frete, mas nao
devolve cotacao de preco.

## 7. Ativar a Transerve

- Obter `TRANSERVE_CLIENT_ID` e `TRANSERVE_CLIENT_SECRET`.
- Rotas de relatorios, viagens, CT-e e NF-e dependem de contratacao e liberacao
  tecnica especifica — implementar so depois de confirmadas.

## Concluido

- Migracao de SQLite para Postgres (regiao ohio, mesma do backend).
- Login com Google, dashboard do usuario e painel de administracao.
- Suite de testes de regressao no backend (`npm test`), incluindo os casos de
  erro async e persistencia transacional.
- Blindagem das rotas: CORS restrito, rate limit e login obrigatorio.
