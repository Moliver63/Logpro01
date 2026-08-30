import { Router } from "express";
import { CepeaPriceReferenceProvider } from "../engines/price_reference/cepeaProvider.js";
import { AlphaVantagePriceReferenceProvider } from "../engines/price_reference/alphaVantageProvider.js";

export const priceReferenceRouter = Router();

const cepea = new CepeaPriceReferenceProvider();
const alphaVantage = new AlphaVantagePriceReferenceProvider(process.env.ALPHA_VANTAGE_API_KEY ?? "");

const PRODUTOS_VALIDOS = new Set(["SOJA", "MILHO", "TRIGO", "OUTRO"]);

/**
 * GET /api/price-reference/:produto — referência de preço, não substitui o
 * preço informado pelo usuário. Tenta primeiro a CEPEA (preço físico
 * brasileiro real, uso não comercial via CC BY-NC 4.0); se não cobrir o
 * produto, cai para a Alpha Vantage (referência internacional CBOT).
 */
priceReferenceRouter.get("/:produto", async (req, res) => {
  const produto = String(req.params.produto).toUpperCase();
  if (!PRODUTOS_VALIDOS.has(produto)) {
    return res.status(400).json({ erro: "Produto inválido" });
  }

  const resultadoCepea = await cepea.getReferencia(produto);
  if (resultadoCepea.aplicavel) {
    return res.json(resultadoCepea);
  }

  const resultadoAlphaVantage = await alphaVantage.getReferencia(produto);
  if (resultadoAlphaVantage.aplicavel) {
    return res.json(resultadoAlphaVantage);
  }

  // Nenhuma fonte cobriu o produto — devolve a pendência mais específica (CEPEA).
  return res.json(resultadoCepea);
});
