import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { operations, operationResults } from "../db/schema.js";
import { exigirLogin } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(exigirLogin);

/**
 * GET /api/dashboard/consultas — histórico do próprio usuário.
 *
 * O filtro por userId é aplicado no banco, não depois: nenhuma consulta de
 * outra pessoa chega a ser carregada.
 */
dashboardRouter.get("/consultas", async (req, res, next) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 50, 200);

    const linhas = await db
      .select({
        id: operations.id,
        produto: operations.produto,
        quantidadeSacas: operations.quantidadeSacas,
        criadoEm: operations.criadoEm,
        status: operations.status,
        resultado: operationResults.resultado,
        margemPercentual: operationResults.margemPercentual,
        viavel: operationResults.viavel,
      })
      .from(operations)
      .leftJoin(operationResults, eq(operationResults.operationId, operations.id))
      .where(eq(operations.userId, req.usuario!.id))
      .orderBy(desc(operations.criadoEm))
      .limit(limite);

    return res.json({ consultas: linhas });
  } catch (erro) {
    return next(erro);
  }
});

/** GET /api/dashboard/consultas/:id — detalhe de uma consulta própria. */
dashboardRouter.get("/consultas/:id", async (req, res, next) => {
  try {
    const linhas = await db
      .select()
      .from(operations)
      .leftJoin(operationResults, eq(operationResults.operationId, operations.id))
      // O userId entra no WHERE junto com o id: pedir o id de outra pessoa
      // devolve 404, não os dados dela.
      .where(and(eq(operations.id, req.params.id), eq(operations.userId, req.usuario!.id)))
      .limit(1);

    if (linhas.length === 0) {
      return res.status(404).json({ erro: "Consulta não encontrada." });
    }

    return res.json(linhas[0]);
  } catch (erro) {
    return next(erro);
  }
});

/** GET /api/dashboard/resumo — números do topo do painel. */
dashboardRouter.get("/resumo", async (req, res, next) => {
  try {
    const linhas = await db
      .select({
        viavel: operationResults.viavel,
        margemPercentual: operationResults.margemPercentual,
      })
      .from(operations)
      .innerJoin(operationResults, eq(operationResults.operationId, operations.id))
      .where(eq(operations.userId, req.usuario!.id));

    const total = linhas.length;
    const viaveis = linhas.filter((l) => l.viavel).length;
    const margemMedia =
      total > 0 ? linhas.reduce((acc, l) => acc + l.margemPercentual, 0) / total : 0;

    return res.json({
      total,
      viaveis,
      naoViaveis: total - viaveis,
      margemMedia: Math.round(margemMedia * 100) / 100,
    });
  } catch (erro) {
    return next(erro);
  }
});
