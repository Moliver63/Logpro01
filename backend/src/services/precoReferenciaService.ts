import { CepeaPriceReferenceProvider } from "../engines/price_reference/cepeaProvider.js";
import { AlphaVantagePriceReferenceProvider } from "../engines/price_reference/alphaVantageProvider.js";
import type { ResultadoReferenciaPreco } from "../types/domain.js";

const cepea = new CepeaPriceReferenceProvider();
const alphaVantage = new AlphaVantagePriceReferenceProvider(process.env.ALPHA_VANTAGE_API_KEY ?? "");

/**
 * Única porta de entrada pra referência de preço — REST e o agente de chat
 * passam pela mesma função. Tenta primeiro a CEPEA (preço físico
 * brasileiro real, uso não comercial via CC BY-NC 4.0); se não cobrir o
 * produto, cai para a Alpha Vantage (referência internacional CBOT).
 */
export async function pesquisarReferenciaPreco(produto: string): Promise<ResultadoReferenciaPreco> {
  const resultadoCepea = await cepea.getReferencia(produto);
  if (resultadoCepea.aplicavel) {
    return resultadoCepea;
  }

  const resultadoAlphaVantage = await alphaVantage.getReferencia(produto);
  if (resultadoAlphaVantage.aplicavel) {
    return resultadoAlphaVantage;
  }

  return resultadoCepea;
}
