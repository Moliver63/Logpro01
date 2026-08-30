import type { FreightProvider, CotacaoFrete, DadosLogistica } from "../../../types/domain.js";

/**
 * ManualFreightProvider
 *
 * Primeira versão do freight_engine (item 5 da especificação): o frete é
 * informado manualmente pelo usuário. Implementa a mesma interface
 * FreightProvider que qualquer integração futura (Sapiens Agro,
 * transportadoras, etc.) vai implementar — trocar o provider não deve
 * exigir mudança no deal_engine.
 */
export class ManualFreightProvider implements FreightProvider {
  nome = "manual";

  async getQuote(
    input: DadosLogistica & { toneladas: number }
  ): Promise<CotacaoFrete> {
    if (input.freteTotalInformado != null) {
      return {
        fretePorTonelada: input.freteTotalInformado / input.toneladas,
        freteTotal: input.freteTotalInformado,
        distanciaKm: input.distanciaKm,
        provedor: this.nome,
        origemDado: "informado_usuario",
      };
    }

    if (input.fretePorTonelada != null) {
      return {
        fretePorTonelada: input.fretePorTonelada,
        freteTotal: input.fretePorTonelada * input.toneladas,
        distanciaKm: input.distanciaKm,
        provedor: this.nome,
        origemDado: "informado_usuario",
      };
    }

    // Nenhum valor de frete informado — o freight_engine NUNCA estima frete
    // sozinho nesta fase (mesmo princípio do tax_engine: não inventar dado
    // crítico). A camada acima decide como tratar isso (bloquear cálculo ou
    // pedir o dado).
    return {
      fretePorTonelada: 0,
      freteTotal: 0,
      distanciaKm: input.distanciaKm,
      provedor: this.nome,
      origemDado: "estimado",
    };
  }
}
