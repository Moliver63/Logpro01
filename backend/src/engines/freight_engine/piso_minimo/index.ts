import type {
  RegraPisoMinimo,
  ResultadoPisoMinimo,
  TipoCargaAntt,
  TabelaAntt,
} from "../../../types/domain.js";

export interface PisoMinimoQuery {
  tipoCarga: TipoCargaAntt;
  numeroEixos: number;
  distanciaKm: number;
  freteInformadoTotal?: number;
  tabela?: TabelaAntt; // default "A" — composição veicular completa contratada
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * PisoMinimoEngine
 *
 * Calcula o piso mínimo legal de frete (Lei 13.703/2018) e, se um frete
 * informado for passado, avisa quando ele está abaixo do piso.
 *
 * Mesma regra de ouro do tax_engine: nunca aplica um coeficiente sem
 * regra vigente e ativa para o cenário exato (tabela + tipo de carga +
 * eixos). Sem regra correspondente, retorna pendência em vez de estimar.
 */
export class PisoMinimoEngine {
  constructor(private readonly regras: RegraPisoMinimo[]) {}

  calcular(query: PisoMinimoQuery): ResultadoPisoMinimo {
    const tabela = query.tabela ?? "A";
    const hoje = new Date();

    const regra = this.regras.find(
      (r) =>
        r.ativo &&
        r.tabela === tabela &&
        r.tipoCarga === query.tipoCarga &&
        r.numeroEixos === query.numeroEixos &&
        hoje >= new Date(r.vigenciaInicio) &&
        (!r.vigenciaFim || hoje <= new Date(r.vigenciaFim))
    );

    if (!regra) {
      return {
        aplicavel: false,
        pendencia: `Coeficiente de piso mínimo ANTT não cadastrado ou vencido para Tabela ${tabela}, ${query.tipoCarga}, ${query.numeroEixos} eixos. Confirmar valor vigente em calculadorafrete.antt.gov.br antes de usar como referência.`,
      };
    }

    const valorPiso = round2(query.distanciaKm * regra.ccdPorKm + regra.ccValorFixo);

    return {
      aplicavel: true,
      valorPiso,
      regraId: regra.id,
      fonte: regra.fonte,
      freteInformadoAbaixoDoPiso:
        query.freteInformadoTotal != null ? query.freteInformadoTotal < valorPiso : undefined,
    };
  }
}
