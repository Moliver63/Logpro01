import { Router } from "express";
import { montarDealEngine, executarCalculo, prepararLogisticaComDistancia, ConflitoIdempotenciaError } from "../services/calculoService.js";
import { operacaoInputSchema, simularCenariosSchema } from "./validation.js";

export const operationsRouter = Router();

// Nota: cada handler async encaminha erro via next(erro) — sem isso, o
// Express 4 deixa a requisição pendurada sem resposta e gera unhandled
// rejection no processo.

const TAMANHO_MAX_CHAVE_IDEMPOTENCIA = 200;

operationsRouter.post("/calcular", async (req, res, next) => {
  try {
    const parsed = operacaoInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
    }

    // Idempotência: quem chama pode mandar um header `Idempotency-Key`
    // (um UUID qualquer gerado por tentativa de cálculo). Repetir a
    // requisição com a mesma chave e os mesmos dados — duplo clique, retry
    // de rede — devolve a operação original em vez de gravar duplicata.
    // Mesma chave com dados diferentes é erro do cliente (409).
    const idempotencyKey = req.get("Idempotency-Key")?.trim() || null;
    if (idempotencyKey && idempotencyKey.length > TAMANHO_MAX_CHAVE_IDEMPOTENCIA) {
      return res.status(400).json({
        erro: `Idempotency-Key muito longa (máximo ${TAMANHO_MAX_CHAVE_IDEMPOTENCIA} caracteres)`,
      });
    }

    // Vincula a consulta a quem está logado, para aparecer no dashboard dele.
    const { operationId, resultado, replay } = await executarCalculo(
      parsed.data,
      req.usuario?.id,
      idempotencyKey
    );
    if (replay) res.setHeader("Idempotent-Replayed", "true");
    return res.json({ operationId, resultado });
  } catch (erro) {
    if (erro instanceof ConflitoIdempotenciaError) {
      return res.status(erro.statusCode).json({ erro: erro.message });
    }
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
    const operacao = await prepararLogisticaComDistancia(parsed.data.operacao);
    const resultados = await dealEngine.simularCenarios(operacao, parsed.data.cenarios);

    const melhor = resultados.reduce((a, b) => (b.margemPercentual > a.margemPercentual ? b : a));

    return res.json({ cenarios: resultados, melhorCenario: melhor.nome });
  } catch (erro) {
    return next(erro);
  }
});
