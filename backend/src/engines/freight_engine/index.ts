import type { FreightProvider, CotacaoFrete, DadosLogistica } from "../../types/domain.js";
import { ManualFreightProvider } from "./providers/manual.js";

/**
 * FreightEngine
 *
 * Fachada sobre um ou mais FreightProvider. Hoje só existe o provider
 * manual. Para plugar Sapiens Agro (ou qualquer outro) no futuro:
 *
 *   class SapiensAgroProvider implements FreightProvider { ... }
 *   new FreightEngine([new ManualFreightProvider(), new SapiensAgroProvider()])
 *
 * e `compareQuotes` passa a ter mais de uma cotação para comparar.
 */
export class FreightEngine {
  constructor(private readonly providers: FreightProvider[] = [new ManualFreightProvider()]) {}

  async getQuote(input: DadosLogistica & { toneladas: number }): Promise<CotacaoFrete> {
    // Por ora, usa sempre o primeiro provider (manual). Quando houver mais
    // de um, a escolha pode virar parâmetro ou ir para compareQuotes().
    return this.providers[0].getQuote(input);
  }

  async compareQuotes(
    input: DadosLogistica & { toneladas: number }
  ): Promise<CotacaoFrete[]> {
    return Promise.all(this.providers.map((p) => p.getQuote(input)));
  }
}

export type { FreightProvider, CotacaoFrete } from "../../types/domain.js";
