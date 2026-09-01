import { pgTable, text, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";

/**
 * Schema do LogPro.
 *
 * Postgres (Render). Antes era SQLite local, trocado porque o disco do
 * plano gratuito é efêmero: o banco era recriado a cada redeploy, o que
 * tornava impossível ter contas de usuário e histórico de consultas — tudo
 * sumiria no deploy seguinte.
 *
 * Valores monetários usam doublePrecision para preservar exatamente o
 * comportamento numérico anterior (`real` do SQLite era float64 na
 * prática), evitando qualquer alteração silenciosa nos números já
 * validados contra as planilhas de referência.
 */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  criadoEm: text("criado_em").notNull(),

  // --- Autenticação e controle de acesso ---
  // googleId identifica a conta Google (campo `sub` do perfil). É ele, não
  // o e-mail, que casa o login com o usuário: o e-mail pode mudar, o sub não.
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  // "ADMIN" gerencia usuários; "USUARIO" só enxerga as próprias consultas.
  papel: text("papel").notNull().default("USUARIO"),
  // Admin pode desativar sem apagar — o histórico da pessoa é preservado.
  ativo: boolean("ativo").notNull().default(true),
  ultimoAcessoEm: text("ultimo_acesso_em"),
});

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  tipo: text("tipo"), // cerealista | trading | corretor | produtor
  criadoEm: text("criado_em").notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(), // SOJA, MILHO, TRIGO...
  pesoPadraoSacaKg: doublePrecision("peso_padrao_saca_kg").notNull().default(60),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  municipio: text("municipio").notNull(),
  estado: text("estado").notNull(), // UF
});

export const taxRules = pgTable("tax_rules", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  tributo: text("tributo").notNull(),
  estadoOrigem: text("estado_origem").notNull(),
  estadoDestino: text("estado_destino").notNull(),
  produto: text("produto").notNull(),
  tipoOperacao: text("tipo_operacao").notNull(),
  aliquotaPercentual: doublePrecision("aliquota_percentual"),
  valorFixoPorSaca: doublePrecision("valor_fixo_por_saca"),
  baseDeCalculo: text("base_de_calculo").notNull(),
  beneficioFiscalJson: text("beneficio_fiscal_json"), // JSON serializado
  vigenciaInicio: text("vigencia_inicio").notNull(),
  vigenciaFim: text("vigencia_fim"),
  fonte: text("fonte").notNull(),
  versao: integer("versao").notNull().default(1),
  ativo: boolean("ativo").notNull().default(true),
});

export const taxBenefits = pgTable("tax_benefits", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),
  estado: text("estado").notNull(),
  fonte: text("fonte").notNull(),
  vigenciaInicio: text("vigencia_inicio").notNull(),
  vigenciaFim: text("vigencia_fim"),
});

export const operations = pgTable("operations", {
  id: text("id").primaryKey(),
  companyId: text("company_id"),
  // Dono da consulta. Nulo em operações anteriores ao login (e em cálculos
  // feitos sem sessão), por isso não é notNull.
  userId: text("user_id"),
  produto: text("produto").notNull(),
  quantidadeSacas: doublePrecision("quantidade_sacas").notNull(),
  criadoEm: text("criado_em").notNull(),
  status: text("status").notNull(), // VIAVEL | NAO_VIAVEL
});

export const operationItems = pgTable("operation_items", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  descricao: text("descricao").notNull(),
  valorPorSaca: doublePrecision("valor_por_saca"),
  valorTotal: doublePrecision("valor_total").notNull(),
  origemDado: text("origem_dado").notNull(),
});

export const purchases = pgTable("purchases", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  precoPorSaca: doublePrecision("preco_por_saca").notNull(),
  municipioOrigem: text("municipio_origem").notNull(),
  estadoOrigem: text("estado_origem").notNull(),
  fornecedor: text("fornecedor"),
  condicaoPagamento: text("condicao_pagamento"),
  dataPrevistaPagamento: text("data_prevista_pagamento"),
});

export const sales = pgTable("sales", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  precoPorSaca: doublePrecision("preco_por_saca").notNull(),
  municipioDestino: text("municipio_destino").notNull(),
  estadoDestino: text("estado_destino").notNull(),
  comprador: text("comprador"),
  condicaoPagamento: text("condicao_pagamento"),
  dataPrevistaRecebimento: text("data_prevista_recebimento"),
});

export const freightQuotes = pgTable("freight_quotes", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  provedor: text("provedor").notNull(),
  fretePorTonelada: doublePrecision("frete_por_tonelada").notNull(),
  freteTotal: doublePrecision("frete_total").notNull(),
  distanciaKm: doublePrecision("distancia_km"),
  origemDado: text("origem_dado").notNull(),
  criadoEm: text("criado_em").notNull(),
});

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  descricao: text("descricao").notNull(),
  valorPorSaca: doublePrecision("valor_por_saca"),
  valorTotal: doublePrecision("valor_total").notNull(),
});

export const taxCalculations = pgTable("tax_calculations", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  taxRuleId: text("tax_rule_id").notNull(),
  versaoRegra: integer("versao_regra").notNull(),
  base: doublePrecision("base").notNull(),
  valorBruto: doublePrecision("valor_bruto").notNull(),
  valorComBeneficio: doublePrecision("valor_com_beneficio").notNull(),
  calculadoEm: text("calculado_em").notNull(),
});

export const operationResults = pgTable("operation_results", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  receitaTotal: doublePrecision("receita_total").notNull(),
  custoMercadoria: doublePrecision("custo_mercadoria").notNull(),
  custoLogistico: doublePrecision("custo_logistico").notNull(),
  custoTributario: doublePrecision("custo_tributario").notNull(),
  outrosCustos: doublePrecision("outros_custos").notNull(),
  custoTotal: doublePrecision("custo_total").notNull(),
  resultado: doublePrecision("resultado").notNull(),
  margemPercentual: doublePrecision("margem_percentual").notNull(),
  precoMinimoVendaPorSaca: doublePrecision("preco_minimo_venda_por_saca").notNull(),
  viavel: boolean("viavel").notNull(),
  calculadoEm: text("calculado_em").notNull(),
});

export const scenarioSimulations = pgTable("scenario_simulations", {
  id: text("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  nome: text("nome").notNull(),
  precoCompraPorSaca: doublePrecision("preco_compra_por_saca").notNull(),
  precoVendaPorSaca: doublePrecision("preco_venda_por_saca").notNull(),
  fretePorTonelada: doublePrecision("frete_por_tonelada").notNull(),
  margemPercentual: doublePrecision("margem_percentual").notNull(),
  resultado: doublePrecision("resultado").notNull(),
  criadoEm: text("criado_em").notNull(),
});

/**
 * Sessões de login.
 *
 * Ficam no banco em vez de só num JWT para que o admin consiga revogar
 * acesso de fato: desativar um usuário derruba as sessões dele na hora, em
 * vez de esperar um token expirar.
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  criadoEm: text("criado_em").notNull(),
  expiraEm: text("expira_em").notNull(),
});
