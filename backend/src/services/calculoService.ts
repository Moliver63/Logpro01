import { randomUUID } from "node:crypto";
import { TaxEngine } from "../engines/tax_engine/index.js";
import { FreightEngine } from "../engines/freight_engine/index.js";
import { DealEngine } from "../engines/deal_engine/index.js";
import { PisoMinimoEngine } from "../engines/freight_engine/piso_minimo/index.js";
import { seedPisoMinimoRules } from "../engines/freight_engine/piso_minimo/rules.seed.js";
import { carregarRegrasAtivas } from "../db/taxRulesRepo.js";
import { db } from "../db/client.js";
import { operations, operationResults } from "../db/schema.js";
import type { OperacaoInput, ResultadoOperacao } from "../types/domain.js";

/**
 * Única porta de entrada pro cálculo de viabilidade — REST e chat passam
 * pela mesma função, então o comportamento é idêntico não importa a
 * interface usada. Isso é intencional: a IA do chat nunca calcula nada
 * sozinha, ela só coleta dados e chama exatamente esta função.
 */
export async function montarDealEngine(): Promise<DealEngine> {
  const regras = await carregarRegrasAtivas();
  return new DealEngine(new TaxEngine(regras), new FreightEngine(), new PisoMinimoEngine(seedPisoMinimoRules));
}

export async function executarCalculo(
  input: OperacaoInput
): Promise<{ operationId: string; resultado: ResultadoOperacao }> {
  const dealEngine = await montarDealEngine();
  const resultado = await dealEngine.calcular(input);

  const operationId = randomUUID();
  const agora = new Date().toISOString();
  await db.insert(operations).values({
    id: operationId,
    produto: input.mercadoria.produto,
    quantidadeSacas: input.mercadoria.quantidadeSacas,
    criadoEm: agora,
    status: resultado.viavel ? "VIAVEL" : "NAO_VIAVEL",
  });
  await db.insert(operationResults).values({
    id: randomUUID(),
    operationId,
    receitaTotal: resultado.receitaTotal.valor,
    custoMercadoria: resultado.custoMercadoria.valor,
    custoLogistico: resultado.custoLogistico.valor,
    custoTributario: resultado.custoTributario.valor,
    outrosCustos: resultado.outrosCustos.valor,
    custoTotal: resultado.custoTotal.valor,
    resultado: resultado.resultado.valor,
    margemPercentual: resultado.margemPercentual,
    precoMinimoVendaPorSaca: resultado.precoMinimoVendaPorSaca,
    viavel: resultado.viavel,
    calculadoEm: agora,
  });

  return { operationId, resultado };
}
