import { sqlite, db } from "./client.js";
import { taxRules } from "./schema.js";
import { seedTaxRules } from "../engines/tax_engine/rules.seed.js";

/**
 * Cria as tabelas (SQL simples, sem ferramenta de migração ainda — trocar
 * por drizzle-kit generate/migrate quando o schema estabilizar) e carrega
 * as regras tributárias de referência extraídas das planilhas reais.
 */

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, cnpj TEXT, tipo TEXT, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, peso_padrao_saca_kg REAL NOT NULL DEFAULT 60
);
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY, municipio TEXT NOT NULL, estado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tax_rules (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, tributo TEXT NOT NULL,
  estado_origem TEXT NOT NULL, estado_destino TEXT NOT NULL, produto TEXT NOT NULL,
  tipo_operacao TEXT NOT NULL, aliquota_percentual REAL, valor_fixo_por_saca REAL,
  base_de_calculo TEXT NOT NULL, beneficio_fiscal_json TEXT,
  vigencia_inicio TEXT NOT NULL, vigencia_fim TEXT, fonte TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1, ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS tax_benefits (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT NOT NULL, estado TEXT NOT NULL,
  fonte TEXT NOT NULL, vigencia_inicio TEXT NOT NULL, vigencia_fim TEXT
);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY, company_id TEXT, produto TEXT NOT NULL, quantidade_sacas REAL NOT NULL,
  criado_em TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operation_items (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, descricao TEXT NOT NULL,
  valor_por_saca REAL, valor_total REAL NOT NULL, origem_dado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, preco_por_saca REAL NOT NULL,
  municipio_origem TEXT NOT NULL, estado_origem TEXT NOT NULL, fornecedor TEXT,
  condicao_pagamento TEXT, data_prevista_pagamento TEXT
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, preco_por_saca REAL NOT NULL,
  municipio_destino TEXT NOT NULL, estado_destino TEXT NOT NULL, comprador TEXT,
  condicao_pagamento TEXT, data_prevista_recebimento TEXT
);
CREATE TABLE IF NOT EXISTS freight_quotes (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, provedor TEXT NOT NULL,
  frete_por_tonelada REAL NOT NULL, frete_total REAL NOT NULL, distancia_km REAL,
  origem_dado TEXT NOT NULL, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, descricao TEXT NOT NULL,
  valor_por_saca REAL, valor_total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS tax_calculations (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, tax_rule_id TEXT NOT NULL,
  versao_regra INTEGER NOT NULL, base REAL NOT NULL, valor_bruto REAL NOT NULL,
  valor_com_beneficio REAL NOT NULL, calculado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operation_results (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, receita_total REAL NOT NULL,
  custo_mercadoria REAL NOT NULL, custo_logistico REAL NOT NULL, custo_tributario REAL NOT NULL,
  outros_custos REAL NOT NULL, custo_total REAL NOT NULL, resultado REAL NOT NULL,
  margem_percentual REAL NOT NULL, preco_minimo_venda_por_saca REAL NOT NULL,
  viavel INTEGER NOT NULL, calculado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scenario_simulations (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, nome TEXT NOT NULL,
  preco_compra_por_saca REAL NOT NULL, preco_venda_por_saca REAL NOT NULL,
  frete_por_tonelada REAL NOT NULL, margem_percentual REAL NOT NULL, resultado REAL NOT NULL,
  criado_em TEXT NOT NULL
);
`);

const jaExiste = sqlite.prepare("SELECT COUNT(*) as n FROM tax_rules").get() as { n: number };

if (jaExiste.n === 0) {
  const insert = db.insert(taxRules);
  for (const r of seedTaxRules) {
    insert
      .values({
        id: r.id,
        nome: r.nome,
        tributo: r.tributo,
        estadoOrigem: r.estadoOrigem,
        estadoDestino: r.estadoDestino,
        produto: r.produto,
        tipoOperacao: r.tipoOperacao,
        aliquotaPercentual: r.aliquotaPercentual,
        valorFixoPorSaca: r.valorFixoPorSaca,
        baseDeCalculo: r.baseDeCalculo,
        beneficioFiscalJson: r.beneficioFiscal ? JSON.stringify(r.beneficioFiscal) : null,
        vigenciaInicio: r.vigenciaInicio,
        vigenciaFim: r.vigenciaFim,
        fonte: r.fonte,
        versao: r.versao,
        ativo: r.ativo,
      })
      .run();
  }
  console.log(`Seed: ${seedTaxRules.length} regras tributárias de referência carregadas.`);
} else {
  console.log("Seed: tax_rules já populada, nada a fazer.");
}
