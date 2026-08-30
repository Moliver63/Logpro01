import { Router } from "express";
import { randomUUID } from "node:crypto";
import { TaxEngine } from "../engines/tax_engine/index.js";
import { FreightEngine } from "../engines/freight_engine/index.js";
import { DealEngine } from "../engines/deal_engine/index.js";
import { carregarRegrasAtivas } from "../db/taxRulesRepo.js";
import { db } from "../db/client.js";
import { operations, operationResults } from "../db/schema.js";
import { operacaoInputSchema, simularCenariosSchema } from "./validation.js";

export const operationsRouter = Router();

async function montarDealEngine(): Promise<DealEngine> {
  const regras = await carregarRegrasAtivas();
  return new DealEngine(new TaxEngine(regras), new FreightEngine());
}

operationsRouter.post("/calcular", async (req, res) => {
  const parsed = operacaoInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
  }

  const dealEngine = await montarDealEngine();
  const resultado = await dealEngine.calcular(parsed.data);

  // Persiste operação + resultado para histórico (item 11/12 — nunca sobrescrever, sempre novo registro)
  const operationId = randomUUID();
  const agora = new Date().toISOString();
  await db.insert(operations).values({
    id: operationId,
    produto: parsed.data.mercadoria.produto,
    quantidadeSacas: parsed.data.mercadoria.quantidadeSacas,
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

  return res.json({ operationId, resultado });
});

operationsRouter.post("/simular", async (req, res) => {
  const parsed = simularCenariosSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
  }

  const dealEngine = await montarDealEngine();
  const resultados = await dealEngine.simularCenarios(parsed.data.operacao, parsed.data.cenarios);

  const melhor = resultados.reduce((a, b) => (b.margemPercentual > a.margemPercentual ? b : a));

  return res.json({ cenarios: resultados, melhorCenario: melhor.nome });
});
