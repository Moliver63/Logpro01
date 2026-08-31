# Roadmap Tecnico

Prioridade dos proximos passos tecnicos do LogPro01.

## 1. Testes de regressao

- Ampliar cobertura de `tax_engine`, `deal_engine`, validacao de entrada e chat.
- Manter fixtures com datas fixas para evitar resultado dependente do dia atual.
- Adicionar testes de API para erro async e persistencia transacional.

## 2. Memoria de calculo imutavel

- Persistir linhas de custo, tributos aplicados, regra fiscal usada, frete e piso ANTT junto do resultado.
- Exibir a memoria completa mesmo que regras futuras mudem.
- Guardar versao e fonte de cada regra usada.

## 3. Idempotencia

- Adicionar chave idempotente em `POST /api/operations/calcular`.
- Evitar duplicar operacoes quando o usuario clicar duas vezes ou quando houver retry de rede.
- Persistir hash normalizado do input para auditoria.

## 4. Postgres

- Migrar de SQLite local para Postgres antes de producao.
- Criar migrations versionadas.
- Separar configuracao de desenvolvimento, homologacao e producao.

## 5. Provider real de frete

- Plugar um `FreightProvider` real, mantendo o contrato atual do `freight_engine`.
- Registrar provedor, timestamp e origem da cotacao.
- Comparar frete informado com cotacao real e piso minimo ANTT.

