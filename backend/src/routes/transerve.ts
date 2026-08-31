import { Router } from "express";
import {
  transerveClient,
  TranserveApiError,
  TranserveNaoConfiguradoError,
} from "../integrations/transerve/client.js";
import {
  transerveFreightRequestSchema,
  transerveOcorrenciaQuerySchema,
} from "../integrations/transerve/validation.js";

export const transerveRouter = Router();

/** GET /api/transerve/status — a integração está configurada neste ambiente? */
transerveRouter.get("/status", (_req, res) => {
  res.json({ configurado: transerveClient.estaConfigurado() });
});

/** GET /api/transerve/ocorrencias?cnpj_relacionado=...&codigo_nota_fiscal=... */
transerveRouter.get("/ocorrencias", async (req, res, next) => {
  try {
    const parsed = transerveOcorrenciaQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ erro: "Consulta inválida", detalhes: parsed.error.flatten() });
    }

    const resultado = await transerveClient.consultarOcorrencia(parsed.data);
    return res.json(resultado);
  } catch (erro) {
    if (erro instanceof TranserveNaoConfiguradoError) {
      return res.status(503).json({ erro: erro.message });
    }
    if (erro instanceof TranserveApiError) {
      return res.status(502).json({ erro: erro.message, statusOrigem: erro.status });
    }
    return next(erro);
  }
});

/** POST /api/transerve/fretes — solicita um frete e devolve o código de solicitação. */
transerveRouter.post("/fretes", async (req, res, next) => {
  try {
    const parsed = transerveFreightRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ erro: "Solicitação inválida", detalhes: parsed.error.flatten() });
    }

    const resultado = await transerveClient.solicitarFrete(parsed.data);
    return res.status(201).json(resultado);
  } catch (erro) {
    if (erro instanceof TranserveNaoConfiguradoError) {
      return res.status(503).json({ erro: erro.message });
    }
    if (erro instanceof TranserveApiError) {
      return res.status(502).json({ erro: erro.message, statusOrigem: erro.status });
    }
    return next(erro);
  }
});
