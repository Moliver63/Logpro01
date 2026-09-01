import { Router } from "express";
import { z } from "zod";
import { calcularReferenciaFreteAntt } from "../services/freteReferenciaService.js";

export const freightReferenceRouter = Router();

const pontoRotaSchema = z.object({
  municipio: z.string().trim().min(1).max(120),
  uf: z.string().trim().min(2).max(2),
});

const referenciaAnttSchema = z.object({
  quantidadeSacas: z.number().finite().gt(0).optional(),
  pesoPorSacaKg: z.number().finite().gt(0).lt(200).optional(),
  distanciaKm: z.number().finite().gt(0).optional(),
  numeroEixos: z.number().int().gte(2).lte(9).optional(),
  tipoCarga: z
    .enum(["GRANEL_SOLIDO", "GRANEL_LIQUIDO", "CARGA_GERAL", "FRIGORIFICADA", "PERIGOSA", "NEOGRANEL"])
    .optional(),
  tabela: z.enum(["A", "B", "C", "D"]).optional(),
  // Sem distância informada, ela é calculada via OpenStreetMap/OSRM a
  // partir dos municípios de origem e destino.
  origem: pontoRotaSchema.optional(),
  destino: pontoRotaSchema.optional(),
});

freightReferenceRouter.post("/antt", async (req, res, next) => {
  try {
    const parsed = referenciaAnttSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ erro: "Entrada inválida", detalhes: parsed.error.flatten() });
    }

    return res.json(await calcularReferenciaFreteAntt(parsed.data));
  } catch (erro) {
    return next(erro);
  }
});
