# Roadmap Tecnico

Prioridade dos proximos passos tecnicos do LogPro01.

## 1. Testes de regressao

- Ampliar cobertura de `tax_engine`, `deal_engine`, validacao de entrada e chat.
- Manter fixtures com datas fixas para evitar resultado dependente do dia atual.
- Adicionar testes de API para erro async e persistencia transacional.

## 2. Memoria de calculo imutavel

- ~~Persistir linhas de custo, tributos aplicados, regra fiscal usada, frete e piso ANTT junto do resultado.~~ Feito: o resultado completo fica em `operation_results.resultado_json`, imutavel.
- Exibir a memoria completa a partir do historico persistido, mesmo que regras futuras mudem.
- Guardar versao e fonte de cada regra usada (parcial: a versao da regra ja vai na memoria serializada; falta consulta dedicada).

## 3. Idempotencia

Concluido.

- `POST /api/operations/calcular` aceita o header `Idempotency-Key`, escopado por usuario.
- Mesma chave + mesmo input devolve a operacao original (replay a partir do `resultado_json` persistido), sem duplicar operacao em duplo clique ou retry de rede.
- Mesma chave + input diferente retorna 409.
- Hash normalizado do input persistido em `idempotency_keys.input_hash` para auditoria.
- Corrida de duas requisicoes simultaneas com a mesma chave e resolvida pela PK da tabela: a perdedora rele a vencedora e devolve o mesmo resultado.

## 4. Postgres

- Migrar de SQLite local para Postgres antes de producao.
- Criar migrations versionadas.
- Separar configuracao de desenvolvimento, homologacao e producao.

## 5. Provider real de frete

- Plugar um `FreightProvider` real, mantendo o contrato atual do `freight_engine`.
- Registrar provedor, timestamp e origem da cotacao.
- Comparar frete informado com cotacao real e piso minimo ANTT.
- Avaliar Sapiens Fretes/SPIA ou outro fornecedor com API contratada para
  preencher `freteReferenciaMercado` sem depender de digitacao manual.

## 6. Operacoes mais complexas

- Criar cadastro de perfis de comprador, vendedor, transportadora e armazem, com dados fiscais e comerciais reutilizaveis.
- Modelar contratos com prazo de pagamento, prazo de entrega, quebra tecnica, umidade, desconto de qualidade, seguro, armazenagem e custo financeiro.
- Permitir rotas com multiplos trechos, transbordo, frete combinado e mais de uma transportadora.
- Persistir preferencias de usuario no backend, nao apenas no navegador, com escopo por usuario e por empresa.
- Criar biblioteca versionada de perfis tributarios validados por especialista, sem substituir a regra fiscal do `tax_engine` por anotacoes manuais.
- Adicionar aprovacao operacional para calculos incompletos, com trilha de auditoria de quem aceitou pendencias.
- Implementar anexos de memoria: cotacao de frete, comprovante de preco, regra fiscal validada, contrato, NF-e/CT-e quando houver integracao.
