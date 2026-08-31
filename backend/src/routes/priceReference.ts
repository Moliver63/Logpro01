import { Router } from "express";
import { pesquisarReferenciaPreco } from "../services/precoReferenciaService.js";

export const priceReferenceRouter = Router();

const PRODUTOS_VALIDOS = new Set(["SOJA", "MILHO", "TRIGO", "SORGO", "OUTRO"]);

/**
 * GET /api/price-reference/:produto — referência de preço, não substitui o
 * preço informado pelo usuário.
 */
priceReferenceRouter.get("/:produto", async (req, res, next) => {
  try {
    const produto = String(req.params.produto).toUpperCase();
    if (!PRODUTOS_VALIDOS.has(produto)) {
      return res.status(400).json({ erro: "Produto inválido" });
    }

    const resultado = await pesquisarReferenciaPreco(produto);
    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
});
