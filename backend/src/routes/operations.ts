import { Router } from "express";
import { montarDealEngine, executarCalculo } from "../services/calculoService.js";
import { operacaoInputSchema, simularCenariosSchema } from "./validation.js";

export const operationsRouter = Router();

// Nota: cada handler async encaminha erro via next(erro) — sem isso, o
// Express 4 deixa a requisição pendurada sem resposta e gera unhandled
// rejection no processo.

operationsRouter.post("/calcular", async (req, res, next) => {
  try {
    const parsed = operacaoInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
    }

    // Vincula a consulta a quem está logado, para aparecer no dashboard dele.
    const { operationId, resultado } = await executarCalculo(parsed.data, req.usuario?.id);
    return res.json({ operationId, resultado });
  } catch (erro) {
    return next(erro);
  }
});

operationsRouter.post("/simular", async (req, res, next) => {
  try {
    const parsed = simularCenariosSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
    }

    const dealEngine = await montarDealEngine();
    const resultados = await dealEngine.simularCenarios(parsed.data.operacao, parsed.data.cenarios);

    const melhor = resultados.reduce((a, b) => (b.margemPercentual > a.margemPercentual ? b : a));

    return res.json({ cenarios: resultados, melhorCenario: melhor.nome });
  } catch (erro) {
    return next(erro);
  }
});
