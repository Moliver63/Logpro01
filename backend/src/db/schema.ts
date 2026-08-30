import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Schema inicial do LogPro (item 11 da especificação).
 *
 * Usa SQLite (better-sqlite3) para rodar localmente sem depender de infra
 * externa. A API do drizzle-orm para tabelas relacionais é praticamente a
 * mesma entre sqlite-core e pg-core — migrar para Postgres depois (mesma
 * linha de código da MecProAI) é trocar os imports de `drizzle-orm/sqlite-core`
 * para `drizzle-orm/pg-core` e os tipos de coluna equivalentes, sem reescrever
 * a lógica de negócio (que vive nos engines, não aqui).
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  criadoEm: text("criado_em").notNull(),
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  tipo: text("tipo"), // cerealista | trading | corretor | produtor
  criadoEm: text("criado_em").notNull(),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(), // SOJA, MILHO, TRIGO...
  pesoPadraoSacaKg: real("peso_padrao_saca_kg").notNull().default(60),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  municipio: text("municipio").notNull(),
  estado: text("estado").notNull(), // UF
});

export const taxRules = sqliteTable("tax_rules", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  tributo: text("tributo").notNull(),
  estadoOrigem: text("estado_origem").notNull(),
  estadoDestino: text("estado_destino").notNull(),
  produto: text("produto").notNull(),
  tipoOperacao: text("tipo_operacao").notNull(),
  aliquotaPercentual: real("aliquota_percentual"),
  valorFixoPorSaca: real("valor_fixo_por_saca"),
  baseDeCalculo: text("base_de_calculo").notNull(),
  beneficioFiscalJson: text("beneficio_fiscal_json"), // JSON serializado
  vigenciaInicio: text("vigencia_inicio").notNull(),
  vigenciaFim: text("vigencia_fim"),
  fonte: text("fonte").notNull(),
  versao: integer("versao").notNull().default(1),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
});

export const taxBenefits = sqliteTable("tax_benefits", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),
  estado: text("estado").notNull(),
  fonte: text("fonte").notNull(),
  vigenciaInicio: text("vigencia_inicio").notNull(),
  vigenciaFim: text("vigencia_fim"),
});

export const operations = sqliteTable("operations", {
  id: text("id").primaryKey(),
  companyId: text("company_id"),
  produto: text("produto").notNull(),
  quantidadeSacas: real("quantidade_sacas").notNull(),
  criadoEm: text("criado_em").notNull(),
  status: text("status").notNull(), // VIAVEL | NAO_VIAVEL
});

export const operationItems = sqliteTable("operation_items", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  descricao: text("descricao").notNull(),
  valorPorSaca: real("valor_por_saca"),
  valorTotal: real("valor_total").notNull(),
  origemDado: text("origem_dado").notNull(),
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  precoPorSaca: real("preco_por_saca").notNull(),
  municipioOrigem: text("municipio_origem").notNull(),
  estadoOrigem: text("estado_origem").notNull(),
  fornecedor: text("fornecedor"),
  condicaoPagamento: text("condicao_pagamento"),
  dataPrevistaPagamento: text("data_prevista_pagamento"),
});

export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  precoPorSaca: real("preco_por_saca").notNull(),
  municipioDestino: text("municipio_destino").notNull(),
  estadoDestino: text("estado_destino").notNull(),
  comprador: text("comprador"),
  condicaoPagamento: text("condicao_pagamento"),
  dataPrevistaRecebimento: text("data_prevista_recebimento"),
});

export const freightQuotes = sqliteTable("freight_quotes", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  provedor: text("provedor").notNull(),
  fretePorTonelada: real("frete_por_tonelada").notNull(),
  freteTotal: real("frete_total").notNull(),
  distanciaKm: real("distancia_km"),
  origemDado: text("origem_dado").notNull(),
  criadoEm: text("criado_em").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  descricao: text("descricao").notNull(),
  valorPorSaca: real("valor_por_saca"),
  valorTotal: real("valor_total").notNull(),
});

export const taxCalculations = sqliteTable("tax_calculations", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  taxRuleId: text("tax_rule_id").notNull(),
  versaoRegra: integer("versao_regra").notNull(),
  base: real("base").notNull(),
  valorBruto: real("valor_bruto").notNull(),
  valorComBeneficio: real("valor_com_beneficio").notNull(),
  calculadoEm: text("calculado_em").notNull(),
});

export const operationResults = sqliteTable("operation_results", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  receitaTotal: real("receita_total").notNull(),
  custoMercadoria: real("custo_mercadoria").notNull(),
  custoLogistico: real("custo_logistico").notNull(),
  custoTributario: real("custo_tributario").notNull(),
  outrosCustos: real("outros_custos").notNull(),
  custoTotal: real("custo_total").notNull(),
  resultado: real("resultado").notNull(),
  margemPercentual: real("margem_percentual").notNull(),
  precoMinimoVendaPorSaca: real("preco_minimo_venda_por_saca").notNull(),
  viavel: integer("viavel", { mode: "boolean" }).notNull(),
  calculadoEm: text("calculado_em").notNull(),
});

export const scenarioSimulations = sqliteTable("scenario_simulations", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  nome: text("nome").notNull(),
  precoCompraPorSaca: real("preco_compra_por_saca").notNull(),
  precoVendaPorSaca: real("preco_venda_por_saca").notNull(),
  fretePorTonelada: real("frete_por_tonelada").notNull(),
  margemPercentual: real("margem_percentual").notNull(),
  resultado: real("resultado").notNull(),
  criadoEm: text("criado_em").notNull(),
});
