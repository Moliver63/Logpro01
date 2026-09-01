import { db, pool } from "./client.js";
import { taxRules } from "./schema.js";
import { seedTaxRules } from "../engines/tax_engine/rules.seed.js";
import { sql } from "drizzle-orm";

/**
 * Cria as tabelas e carrega as regras tributárias de referência extraídas
 * das planilhas reais.
 *
 * Roda a cada start do backend (ver script `start` no package.json), então
 * precisa ser idempotente: tudo é IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
 * e a carga das regras só acontece quando a tabela está vazia.
 *
 * Ainda é SQL na mão em vez de drizzle-kit migrate — trocar quando o schema
 * estabilizar.
 */

async function main() {
  await db.execute(sql.raw(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, cnpj TEXT, tipo TEXT, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, peso_padrao_saca_kg DOUBLE PRECISION NOT NULL DEFAULT 60
);
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY, municipio TEXT NOT NULL, estado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tax_rules (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, tributo TEXT NOT NULL,
  estado_origem TEXT NOT NULL, estado_destino TEXT NOT NULL, produto TEXT NOT NULL,
  tipo_operacao TEXT NOT NULL, aliquota_percentual DOUBLE PRECISION, valor_fixo_por_saca DOUBLE PRECISION,
  base_de_calculo TEXT NOT NULL, beneficio_fiscal_json TEXT,
  vigencia_inicio TEXT NOT NULL, vigencia_fim TEXT, fonte TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1, ativo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS tax_benefits (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT NOT NULL, estado TEXT NOT NULL,
  fonte TEXT NOT NULL, vigencia_inicio TEXT NOT NULL, vigencia_fim TEXT
);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY, company_id TEXT, produto TEXT NOT NULL, quantidade_sacas DOUBLE PRECISION NOT NULL,
  criado_em TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operation_items (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, descricao TEXT NOT NULL,
  valor_por_saca DOUBLE PRECISION, valor_total DOUBLE PRECISION NOT NULL, origem_dado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, preco_por_saca DOUBLE PRECISION NOT NULL,
  municipio_origem TEXT NOT NULL, estado_origem TEXT NOT NULL, fornecedor TEXT,
  condicao_pagamento TEXT, data_prevista_pagamento TEXT
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, preco_por_saca DOUBLE PRECISION NOT NULL,
  municipio_destino TEXT NOT NULL, estado_destino TEXT NOT NULL, comprador TEXT,
  condicao_pagamento TEXT, data_prevista_recebimento TEXT
);
CREATE TABLE IF NOT EXISTS freight_quotes (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, provedor TEXT NOT NULL,
  frete_por_tonelada DOUBLE PRECISION NOT NULL, frete_total DOUBLE PRECISION NOT NULL, distancia_km DOUBLE PRECISION,
  origem_dado TEXT NOT NULL, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, descricao TEXT NOT NULL,
  valor_por_saca DOUBLE PRECISION, valor_total DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS tax_calculations (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, tax_rule_id TEXT NOT NULL,
  versao_regra INTEGER NOT NULL, base DOUBLE PRECISION NOT NULL, valor_bruto DOUBLE PRECISION NOT NULL,
  valor_com_beneficio DOUBLE PRECISION NOT NULL, calculado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operation_results (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, receita_total DOUBLE PRECISION NOT NULL,
  custo_mercadoria DOUBLE PRECISION NOT NULL, custo_logistico DOUBLE PRECISION NOT NULL, custo_tributario DOUBLE PRECISION NOT NULL,
  outros_custos DOUBLE PRECISION NOT NULL, custo_total DOUBLE PRECISION NOT NULL, resultado DOUBLE PRECISION NOT NULL,
  margem_percentual DOUBLE PRECISION NOT NULL, preco_minimo_venda_por_saca DOUBLE PRECISION NOT NULL,
  viavel BOOLEAN NOT NULL, calculado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scenario_simulations (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, nome TEXT NOT NULL,
  preco_compra_por_saca DOUBLE PRECISION NOT NULL, preco_venda_por_saca DOUBLE PRECISION NOT NULL,
  frete_por_tonelada DOUBLE PRECISION NOT NULL, margem_percentual DOUBLE PRECISION NOT NULL, resultado DOUBLE PRECISION NOT NULL,
  criado_em TEXT NOT NULL
);
`));

  // Colunas adicionadas depois da primeira versão do schema. Como o banco de
  // produção pode já existir com as tabelas antigas, um CREATE TABLE IF NOT
  // EXISTS não bastaria — ele não altera tabela existente.
  await db.execute(sql.raw(`
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS papel TEXT NOT NULL DEFAULT 'USUARIO';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_acesso_em TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  criado_em TEXT NOT NULL, expira_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
`));

  const existentes = await db.select().from(taxRules);
  if (existentes.length === 0) {
    for (const r of seedTaxRules) {
      await db.insert(taxRules).values({
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
      });
    }
    console.log(`Seed: ${seedTaxRules.length} regras tributárias de referência carregadas.`);
  } else {
    console.log("Seed: tax_rules já populada, nada a fazer.");
  }

  // Promove a admin o e-mail definido em ADMIN_EMAIL. O primeiro admin
  // precisa vir de fora, senão não existe ninguém para promover ninguém.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    const r = await db.execute(
      sql`UPDATE users SET papel = 'ADMIN' WHERE lower(email) = ${adminEmail} AND papel <> 'ADMIN'`
    );
    if (r.rowCount) console.log(`Seed: ${adminEmail} promovido a ADMIN.`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error("Falha no seed:", e);
  process.exit(1);
});
