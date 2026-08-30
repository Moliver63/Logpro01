import { Router } from "express";
import { AlphaVantagePriceReferenceProvider } from "../engines/price_reference/alphaVantageProvider.js";

export const priceReferenceRouter = Router();

const provider = new AlphaVantagePriceReferenceProvider(process.env.ALPHA_VANTAGE_API_KEY ?? "");

const PRODUTOS_VALIDOS = new Set(["SOJA", "MILHO", "TRIGO", "OUTRO"]);

/** GET /api/price-reference/:produto — referência internacional (CBOT), não substitui preço informado pelo usuário. */
priceReferenceRouter.get("/:produto", async (req, res) => {
  const produto = String(req.params.produto).toUpperCase();
  if (!PRODUTOS_VALIDOS.has(produto)) {
    return res.status(400).json({ erro: "Produto inválido" });
  }
  const resultado = await provider.getReferencia(produto);
  return res.json(resultado);
});
