import { Router } from "express";
import { montarDealEngine, executarCalculo } from "../services/calculoService.js";
import { operacaoInputSchema, simularCenariosSchema } from "./validation.js";

export const operationsRouter = Router();

operationsRouter.post("/calcular", async (req, res) => {
  const parsed = operacaoInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
  }

  const { operationId, resultado } = await executarCalculo(parsed.data);
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
